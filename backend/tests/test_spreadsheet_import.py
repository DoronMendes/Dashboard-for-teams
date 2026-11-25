from pathlib import Path

from fastapi.testclient import TestClient

XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def test_imports_projects_and_links_from_xlsx(client: TestClient, project: dict) -> None:
    workspace_id = project["workspace_id"]
    workbook = Path("tests/fixtures/valid-project-import.xlsx").read_bytes()

    response = client.post(
        f"/api/v1/imports/spreadsheet?workspace_id={workspace_id}",
        content=workbook,
        headers={"Content-Type": XLSX_CONTENT_TYPE},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"projects_created": 1, "links_created": 1}
    projects = client.get("/api/v1/projects").json()
    imported = next(item for item in projects if item["name"] == "פרויקט מיובא")
    assert imported["icon"] == "📊"
    assert imported["links"][0]["title"] == "Google"
    assert imported["links"][0]["url"] == "https://google.com"
    assert set(imported["links"][0]["tags"]) == {"בדיקה", "חיצוני"}


def test_rejects_wrong_upload_type(client: TestClient, project: dict) -> None:
    response = client.post(
        f"/api/v1/imports/spreadsheet?workspace_id={project['workspace_id']}",
        content=b"not a workbook",
        headers={"Content-Type": "text/plain"},
    )

    assert response.status_code == 415
