import asyncio
import json
import os
import shutil
import stat
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator, Callable, Literal
from uuid import uuid4

import file_tools
import photo_tools
import scanner
import uvicorn
from adb import ADB
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typings import BackupYield, LogEntry, UserConfig

DEV = os.getenv("DEV", "false").lower() == "true"


class BackupData(BaseModel):
    config: UserConfig
    sourcePath: str | None = None


class AppState(BaseModel):
    adb: ADB | None = None
    backup_jobs: dict[str, BackupData] = {}

    model_config = {"arbitrary_types_allowed": True}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    print("NODE_READ_SERVER_READY", flush=True)
    yield
    # Shutdown logic


app = FastAPI(lifespan=lifespan)
app.state.data = AppState()

ADB_NOT_INITIALISED = 409
ADB_NO_CONNECTION = 503


def get_app_state(request: Request) -> AppState:
    return request.app.state.data


@app.post("/connect")
async def connect(host: str = Query("127.0.0.1", description="ADB server host"), port: int = Query(5037, description="ADB server port"), state: AppState = Depends(get_app_state)):
    state.adb = ADB(host, port)

    if not state.adb.is_alive():
        raise HTTPException(status_code=ADB_NO_CONNECTION, detail="Could not connect to ADB server")

    return {}


@app.get("/devices")
async def devices(state: AppState = Depends(get_app_state)):
    if state.adb is None:
        raise HTTPException(status_code=ADB_NOT_INITIALISED, detail="ADB is not initialised")

    try:
        devices = state.adb.get_devices()

        return {
            "devices": [
                {
                    "serial": device.serial,
                    "authorised": device.authorised,
                    **({"name": device.friendly_name} if device.authorised else {}),
                }
                for device in devices
            ]
        }

    except:
        raise HTTPException(status_code=ADB_NO_CONNECTION, detail="Could not connect to ADB server")


@app.post("/backup/start")
async def backup_start(body: BackupData, state: AppState = Depends(get_app_state)):
    id = str(uuid4())
    state.backup_jobs[id] = body
    return {"jobId": id}


@app.get("/backup")
async def backup(jobId: str = Query("", description="ID given from `/backup/start` containing configuration"), state: AppState = Depends(get_app_state)):
    def get_stage_progress_range(stage_weights: dict[str, float]) -> dict[str, tuple[float, float]]:
        # * Ensure Python 3.7+ for ordered dictionaries
        total = sum(stage_weights.values())
        start = 0
        progress_ranges: dict[str, tuple[float, float]] = {}
        for stage, weight in stage_weights.items():
            end = start + (weight / total)
            progress_ranges.update({stage: (start, end)})
            start = end

        return progress_ranges

    class StreamedBackupLogEntry(BaseModel):
        timestamp: int
        type: Literal["info", "success", "error", "warning"]
        content: str

    class StreamedBackupResponse(BaseModel):
        progress: float | None = None
        log: StreamedBackupLogEntry | None = None

    def format_yield(obj: BackupYield, progress_range: tuple[float, float] = (0, 1)) -> str:
        progress = obj.progress
        if progress is not None:
            start, end = progress_range
            progress = start + (end - start) * progress

        log_entry = obj.log
        if log_entry is not None:
            log_entry = StreamedBackupLogEntry(timestamp=int(time.time()), type=log_entry.type, content=log_entry.content)

        response = StreamedBackupResponse(
            progress=progress,
            log=log_entry,
        )
        return f"data: {response.model_dump_json(exclude_none=True)}\n\n"

    def yield_error(e: Exception):
        if isinstance(e, HTTPException):
            data = json.dumps({"status": e.status_code, "detail": e.detail})
        else:
            data = json.dumps({"status": 400, "detail": str(e)})
        return f"event: backend-error\ndata: {data}\n\n"

    def yield_complete():
        return f"event: backend-complete\ndata: \n\n"

    async def event_generator():
        backup_data = state.backup_jobs.pop(jobId, None)
        if backup_data is None:
            yield yield_error(HTTPException(status_code=400, detail="jobId does not correspond to a given backup job"))
            return

        adb = state.adb
        if backup_data.sourcePath is None and adb is None:
            yield yield_error(HTTPException(status_code=ADB_NOT_INITIALISED, detail="ADB is not initialised"))
            return

        # Create temporary working folder
        now = time.strftime("%Y-%m-%d_%H-%M-%S")
        folder_path = Path(".", f".temp_{now}")
        folder_path.mkdir()

        progress_ranges = get_stage_progress_range(
            {
                "scan": 0.5,
                "exif": 0.225 if backup_data.config.setExif else 0,
                "move": 0.225,
                "removeTemp": 0.05 if backup_data.config.removeTempFiles else 0,
            }
        )

        # Find and move/copy all photos into the working folder
        source_description = "device" if backup_data.sourcePath is None else "source folder"
        yield format_yield(BackupYield(log=LogEntry(content=f"Scanning {source_description}..."), progress=0), progress_ranges["scan"])
        try:
            scan_results = (
                scanner.scan_device(folder_path, adb, backup_data.config)
                if backup_data.sourcePath is None
                else scanner.scan_local_folder(folder_path, Path(backup_data.sourcePath), backup_data.config)
            )
            for y in scan_results:
                yield format_yield(y, progress_ranges["scan"])
        except Exception as e:
            yield yield_error(e)
            return
        yield format_yield(BackupYield(log=LogEntry(content=f"{source_description.title()} scan completed"), progress=1), progress_ranges["scan"])

        # Modify photo time in EXIF if required
        if backup_data.config.setExif:
            yield format_yield(BackupYield(log=LogEntry(content="Setting photo time in EXIF..."), progress=0), progress_ranges["exif"])
            try:
                for y in photo_tools.set_photos_exif_time(folder_path):
                    yield format_yield(y, progress_ranges["exif"])
            except Exception as e:
                yield yield_error(e)
                return
            yield format_yield(BackupYield(log=LogEntry(content="Completed EXIF update"), progress=1), progress_ranges["exif"])

        # Move photos from working folder to destination
        yield format_yield(BackupYield(log=LogEntry(content="Moving files to destination"), progress=0), progress_ranges["move"])
        try:
            for y in file_tools.move(folder_path, Path(backup_data.config.destinationPath), now):
                yield format_yield(y, progress_ranges["move"])
        except Exception as e:
            yield yield_error(e)
            return
        yield format_yield(BackupYield(log=LogEntry(content="Moving files completed"), progress=1), progress_ranges["move"])

        # Remove temporary files if required
        if backup_data.config.removeTempFiles:
            yield format_yield(BackupYield(log=LogEntry(content="Removing temporary files..."), progress=0), progress_ranges["removeTemp"])
            try:
                def remove_readonly(func, path, _exc_info):
                    """Make a read-only Windows path writable, then retry its removal."""
                    os.chmod(path, stat.S_IWRITE)
                    func(path)

                shutil.rmtree(folder_path, onerror=remove_readonly)
            except Exception as e:
                yield yield_error(e)
                return
            yield format_yield(BackupYield(log=LogEntry(content="Temporary files removed"), progress=1), progress_ranges["removeTemp"])

        yield format_yield(BackupYield(log=LogEntry(content="Complete!", type="success"), progress=1))
        yield yield_complete()

    async def push_events(generator: Callable[[], AsyncGenerator[str, None]]):
        async for y in generator():
            yield y
            await asyncio.sleep(0)  # Flush yielded data to uvicorn

    return StreamingResponse(push_events(event_generator), media_type="text/event-stream")


# @app.on_event("startup")
# async def startup():
#     print(f"NODE_READ_SERVER_READY", flush=True)


def main():
    PORT = os.getenv("PORT")
    if PORT is None:
        raise RuntimeError("PORT is required but not set.")
    try:
        PORT = int(PORT)
    except ValueError:
        raise ValueError(f"Invalid PORT value: {PORT}.")

    config = uvicorn.Config(app, host="127.0.0.1", port=PORT, log_level="info", reload=DEV)
    server = uvicorn.Server(config)

    server.run()


if __name__ == "__main__":
    main()
