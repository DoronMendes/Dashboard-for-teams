from fastapi.testclient import TestClient

def test_link_tags_creator_and_bookmark(client: TestClient, project: dict) -> None:
    created = client.post(f"/api/v1/projects/{project['id']}/links", json={"title": "Docs", "url": "https://example.com/docs", "tags": ["Onboarding", " docs ", "#Onboarding"]})
    assert created.status_code == 201, created.text
    link = created.json()
    assert set(link["tags"]) == {"Onboarding", "docs"}
    assert link["creator"]["name"] == "Test User"
    assert link["is_bookmarked"] is False

    bookmarked = client.put(f"/api/v1/links/{link['id']}/bookmark")
    assert bookmarked.status_code == 200, bookmarked.text
    assert bookmarked.json()["is_bookmarked"] is True
    project_body = client.get(f"/api/v1/projects/{project['id']}").json()
    assert project_body["links"][0]["is_bookmarked"] is True

    removed = client.delete(f"/api/v1/links/{link['id']}/bookmark")
    assert removed.status_code == 200
    assert removed.json()["is_bookmarked"] is False

def test_project_search_matches_link_and_tag(client: TestClient, project: dict) -> None:
    client.post(f"/api/v1/projects/{project['id']}/links", json={"title": "Runbook", "url": "https://example.com", "tags": ["Emergency"]})
    assert len(client.get("/api/v1/projects", params={"q": "Runbook"}).json()) == 1
    assert len(client.get("/api/v1/projects", params={"q": "Emergency"}).json()) == 1
