from uuid import uuid4

from fastapi.testclient import TestClient

BASE = "/api/v1/projects"


def test_create_returns_201_with_generated_fields(client: TestClient) -> None:
    response = client.post(BASE, json={"name": "Billing", "icon": "💳", "description": "Invoices"})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Billing"
    assert body["icon"] == "💳"
    assert body["is_pinned"] is False
    assert body["position"] == 0
    assert body["links"] == []
    assert body["id"] and body["created_at"] and body["updated_at"]


def test_create_rejects_duplicate_name_with_409(client: TestClient, project: dict) -> None:
    response = client.post(BASE, json={"name": project["name"]})
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_create_rejects_blank_name_with_422(client: TestClient) -> None:
    assert client.post(BASE, json={"name": ""}).status_code == 422


def test_name_is_stripped_of_surrounding_whitespace(client: TestClient) -> None:
    body = client.post(BASE, json={"name": "  Spaced  "}).json()
    assert body["name"] == "Spaced"


def test_list_returns_projects_with_nested_links(client: TestClient, project: dict) -> None:
    client.post(
        f"{BASE}/{project['id']}/links",
        json={"title": "Repo", "url": "https://github.com/acme/pay", "category": "code"},
    )
    body = client.get(BASE).json()
    assert len(body) == 1
    assert [link["title"] for link in body[0]["links"]] == ["Repo"]


def test_list_search_matches_name_case_insensitively(client: TestClient, project: dict) -> None:
    client.post(BASE, json={"name": "Reporting"})
    assert len(client.get(BASE, params={"q": "payments"}).json()) == 1
    assert len(client.get(BASE, params={"q": "report"}).json()) == 1
    assert client.get(BASE, params={"q": "nothing-matches"}).json() == []


def test_list_search_also_matches_description(client: TestClient, project: dict) -> None:
    results = client.get(BASE, params={"q": "billing"}).json()
    assert [item["id"] for item in results] == [project["id"]]


def test_list_respects_pagination(client: TestClient) -> None:
    for index in range(3):
        client.post(BASE, json={"name": f"Project {index}"})
    assert len(client.get(BASE, params={"limit": 2}).json()) == 2
    assert len(client.get(BASE, params={"skip": 2, "limit": 2}).json()) == 1


def test_pinned_projects_are_returned_first(client: TestClient, project: dict) -> None:
    pinned = client.post(BASE, json={"name": "Pinned"}).json()
    response = client.put(f"{BASE}/{pinned['id']}", json={"is_pinned": True})
    assert response.status_code == 200
    assert response.json()["is_pinned"] is True

    results = client.get(BASE).json()
    assert results[0]["id"] == pinned["id"]
    assert results[1]["id"] == project["id"]


def test_project_can_be_unpinned(client: TestClient, project: dict) -> None:
    client.put(f"{BASE}/{project['id']}", json={"is_pinned": True})
    response = client.put(f"{BASE}/{project['id']}", json={"is_pinned": False})
    assert response.status_code == 200
    assert response.json()["is_pinned"] is False


def test_projects_can_be_reordered(client: TestClient) -> None:
    projects = [
        client.post(BASE, json={"name": f"Project {index}"}).json()
        for index in range(3)
    ]
    reordered_ids = [projects[2]["id"], projects[0]["id"], projects[1]["id"]]

    response = client.put(f"{BASE}/reorder", json={"ids": reordered_ids})
    assert response.status_code == 204
    assert [item["id"] for item in client.get(BASE).json()] == reordered_ids


def test_project_reorder_rejects_unknown_and_duplicate_ids(
    client: TestClient, project: dict
) -> None:
    assert client.put(
        f"{BASE}/reorder", json={"ids": [project["id"], str(uuid4())]}
    ).status_code == 404
    assert client.put(
        f"{BASE}/reorder", json={"ids": [project["id"], project["id"]]}
    ).status_code == 422


def test_get_single_project(client: TestClient, project: dict) -> None:
    body = client.get(f"{BASE}/{project['id']}").json()
    assert body["id"] == project["id"]


def test_get_unknown_project_returns_404(client: TestClient) -> None:
    response = client.get(f"{BASE}/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["type"] == "EntityNotFoundError"


def test_get_malformed_uuid_returns_422(client: TestClient) -> None:
    assert client.get(f"{BASE}/not-a-uuid").status_code == 422


def test_update_changes_only_supplied_fields(client: TestClient, project: dict) -> None:
    body = client.put(f"{BASE}/{project['id']}", json={"description": "Updated"}).json()
    assert body["description"] == "Updated"
    assert body["name"] == project["name"]  # untouched


def test_project_icon_can_be_changed_and_cleared(client: TestClient, project: dict) -> None:
    updated = client.put(f"{BASE}/{project['id']}", json={"icon": "🚀"}).json()
    assert updated["icon"] == "🚀"

    cleared = client.put(f"{BASE}/{project['id']}", json={"icon": ""}).json()
    assert cleared["icon"] is None


def test_project_accepts_an_uploaded_image_icon(client: TestClient, project: dict) -> None:
    icon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
    response = client.put(f"{BASE}/{project['id']}", json={"icon": icon})
    assert response.status_code == 200
    assert response.json()["icon"] == icon


def test_project_rejects_unsafe_uploaded_icon_types(client: TestClient, project: dict) -> None:
    response = client.put(
        f"{BASE}/{project['id']}",
        json={"icon": "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="},
    )
    assert response.status_code == 422


def test_update_rejects_a_name_owned_by_another_project(client: TestClient, project: dict) -> None:
    other = client.post(BASE, json={"name": "Reporting"}).json()
    response = client.put(f"{BASE}/{other['id']}", json={"name": project["name"]})
    assert response.status_code == 409


def test_update_allows_keeping_its_own_name(client: TestClient, project: dict) -> None:
    response = client.put(f"{BASE}/{project['id']}", json={"name": project["name"]})
    assert response.status_code == 200


def test_update_rejects_unknown_fields(client: TestClient, project: dict) -> None:
    response = client.put(f"{BASE}/{project['id']}", json={"bogus": "value"})
    assert response.status_code == 422


def test_update_unknown_project_returns_404(client: TestClient) -> None:
    assert client.put(f"{BASE}/{uuid4()}", json={"name": "X"}).status_code == 404


def test_delete_returns_204_and_removes_the_project(client: TestClient, project: dict) -> None:
    assert client.delete(f"{BASE}/{project['id']}").status_code == 204
    assert client.get(f"{BASE}/{project['id']}").status_code == 404


def test_delete_cascades_to_links(client: TestClient, project: dict) -> None:
    link = client.post(
        f"{BASE}/{project['id']}/links",
        json={"title": "Logs", "url": "https://logs.internal", "category": "logs"},
    ).json()

    client.delete(f"{BASE}/{project['id']}")

    assert client.get(f"/api/v1/links/{link['id']}").status_code == 404


def test_delete_unknown_project_returns_404(client: TestClient) -> None:
    assert client.delete(f"{BASE}/{uuid4()}").status_code == 404


def test_database_itself_enforces_the_cascade(client: TestClient, project: dict) -> None:
    """The test above proves the ORM cascade; this proves the FK constraint.

    Deleting through raw SQL bypasses SQLAlchemy's delete-orphan handling, so
    the only thing that can remove the child rows is ON DELETE CASCADE.
    """
    import asyncio

    from sqlalchemy import text

    from tests.conftest import make_test_engine

    client.post(
        f"{BASE}/{project['id']}/links",
        json={"title": "Logs", "url": "https://logs.internal", "category": "logs"},
    )

    async def _raw_delete_and_count() -> int:
        engine = make_test_engine()
        try:
            async with engine.begin() as connection:
                before = await connection.execute(text("SELECT COUNT(*) FROM links"))
                assert before.scalar_one() == 1
                await connection.execute(text("DELETE FROM projects"))
            async with engine.connect() as connection:
                return (await connection.execute(text("SELECT COUNT(*) FROM links"))).scalar_one()
        finally:
            await engine.dispose()

    assert asyncio.run(_raw_delete_and_count()) == 0
