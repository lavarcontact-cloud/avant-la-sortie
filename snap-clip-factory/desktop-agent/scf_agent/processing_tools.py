import shutil


class ToolMissing(RuntimeError):
    pass


def tool(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise ToolMissing(f"{name} introuvable : installer FFmpeg (https://ffmpeg.org/download.html)")
    return path
