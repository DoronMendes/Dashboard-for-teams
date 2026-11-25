from pydantic import BaseModel


class SpreadsheetImportResponse(BaseModel):
    projects_created: int
    links_created: int
