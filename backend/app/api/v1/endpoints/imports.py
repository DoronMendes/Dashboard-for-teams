from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status

from app.api.deps import CurrentUser, LinkSvc, ProjectSvc
from app.schemas.imports import SpreadsheetImportResponse
from app.services.spreadsheet_import import SpreadsheetImportError, import_workbook

router = APIRouter()
MAX_WORKBOOK_SIZE = 5 * 1024 * 1024


@router.post("/spreadsheet", response_model=SpreadsheetImportResponse)
async def import_spreadsheet(
    workspace_id: UUID,
    request: Request,
    current_user: CurrentUser,
    projects: ProjectSvc,
    links: LinkSvc,
) -> SpreadsheetImportResponse:
    if request.headers.get("content-type", "").split(";", 1)[0] != (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="יש להעלות קובץ Excel מסוג XLSX.",
        )
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_WORKBOOK_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="קובץ Excel יכול להיות בגודל של עד 5MB.",
        )
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_WORKBOOK_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="קובץ Excel יכול להיות בגודל של עד 5MB.",
            )
    try:
        result = await import_workbook(
            bytes(body), workspace_id, current_user.id, projects, links
        )
    except SpreadsheetImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    return SpreadsheetImportResponse(**result)
