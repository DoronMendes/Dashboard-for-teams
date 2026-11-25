"""Safe XLSX parsing and bulk project/link import orchestration."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from io import BytesIO
from pathlib import PurePosixPath
from uuid import UUID
from zipfile import BadZipFile, ZipFile

from pydantic import ValidationError

from app.schemas.link import LinkCreate
from app.schemas.project import ProjectCreate
from app.services.link import LinkService
from app.services.project import ProjectService

_MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
_CELL_REFERENCE = re.compile(r"([A-Z]+)")


class SpreadsheetImportError(ValueError):
    """The uploaded workbook is missing required or valid tabular data."""


@dataclass(frozen=True)
class ParsedWorkbook:
    projects: list[tuple[int, str, ProjectCreate]]
    links: list[tuple[int, str, LinkCreate]]


def _column_index(reference: str) -> int:
    match = _CELL_REFERENCE.match(reference.upper())
    if match is None:
        raise SpreadsheetImportError("נמצאה כתובת תא לא תקינה בקובץ.")
    value = 0
    for character in match.group(1):
        value = value * 26 + ord(character) - ord("A") + 1
    return value - 1


def _cell_text(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(f".//{{{_MAIN_NS}}}t"))
    value_node = cell.find(f"{{{_MAIN_NS}}}v")
    if value_node is None or value_node.text is None:
        return ""
    if cell_type == "s":
        try:
            return shared_strings[int(value_node.text)]
        except (ValueError, IndexError) as exc:
            raise SpreadsheetImportError("טבלת הטקסטים בקובץ Excel אינה תקינה.") from exc
    return value_node.text


def _read_rows(
    archive: ZipFile, sheet_path: str, shared_strings: list[str]
) -> list[tuple[int, list[str]]]:
    root = ET.fromstring(archive.read(sheet_path))
    rows: list[tuple[int, list[str]]] = []
    for row in root.findall(f".//{{{_MAIN_NS}}}row"):
        values: dict[int, str] = {}
        for cell in row.findall(f"{{{_MAIN_NS}}}c"):
            values[_column_index(cell.attrib.get("r", "A1"))] = _cell_text(
                cell, shared_strings
            ).strip()
        width = max(values, default=-1) + 1
        rows.append(
            (
                int(row.attrib.get("r", len(rows) + 1)),
                [values.get(index, "") for index in range(width)],
            )
        )
    return rows


def _table_records(
    rows: list[tuple[int, list[str]]], required_headers: set[str], sheet_name: str
) -> list[tuple[int, dict[str, str]]]:
    header_index = next(
        (
            index
            for index, (_, values) in enumerate(rows[:20])
            if required_headers.issubset(set(values))
        ),
        None,
    )
    if header_index is None:
        raise SpreadsheetImportError(
            f"בלשונית {sheet_name} חסרות הכותרות: {', '.join(sorted(required_headers))}."
        )
    _, headers = rows[header_index]
    records: list[tuple[int, dict[str, str]]] = []
    for row_number, values in rows[header_index + 1 :]:
        record = {
            header: values[index].strip() if index < len(values) else ""
            for index, header in enumerate(headers)
            if header
        }
        if any(record.values()):
            records.append((row_number, record))
    return records


def parse_workbook(data: bytes) -> ParsedWorkbook:
    if len(data) > 5 * 1024 * 1024:
        raise SpreadsheetImportError("קובץ Excel יכול להיות בגודל של עד 5MB.")
    try:
        archive = ZipFile(BytesIO(data))
    except BadZipFile as exc:
        raise SpreadsheetImportError("הקובץ אינו קובץ Excel תקין מסוג XLSX.") from exc

    with archive:
        members = archive.infolist()
        if len(members) > 100 or sum(member.file_size for member in members) > 20 * 1024 * 1024:
            raise SpreadsheetImportError("מבנה קובץ Excel גדול או מורכב מדי.")
        try:
            workbook_root = ET.fromstring(archive.read("xl/workbook.xml"))
            relationships_root = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        except (KeyError, ET.ParseError) as exc:
            raise SpreadsheetImportError("מבנה קובץ Excel אינו תקין.") from exc

        relationships = {
            item.attrib["Id"]: item.attrib["Target"]
            for item in relationships_root.findall(f"{{{_PACKAGE_REL_NS}}}Relationship")
        }
        sheet_paths: dict[str, str] = {}
        for sheet in workbook_root.findall(f".//{{{_MAIN_NS}}}sheet"):
            relation_id = sheet.attrib.get(f"{{{_REL_NS}}}id", "")
            target = relationships.get(relation_id, "")
            normalized = str(PurePosixPath("xl") / target.lstrip("/"))
            if target.startswith("/xl/"):
                normalized = target.lstrip("/")
            sheet_paths[sheet.attrib.get("name", "")] = normalized

        missing_sheets = {"Projects", "Links"} - set(sheet_paths)
        if missing_sheets:
            raise SpreadsheetImportError("הקובץ חייב לכלול לשוניות בשם Projects ו־Links.")

        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared_strings = [
                "".join(node.text or "" for node in item.findall(f".//{{{_MAIN_NS}}}t"))
                for item in shared_root.findall(f"{{{_MAIN_NS}}}si")
            ]
        project_rows = _read_rows(archive, sheet_paths["Projects"], shared_strings)
        link_rows = _read_rows(archive, sheet_paths["Links"], shared_strings)

    project_records = _table_records(project_rows, {"project_name"}, "Projects")
    link_records = _table_records(link_rows, {"project_name", "link_title", "url"}, "Links")

    projects: list[tuple[int, str, ProjectCreate]] = []
    project_names: set[str] = set()
    for row_number, record in project_records:
        name = record.get("project_name", "").strip()
        if name.casefold().startswith(("דוגמה:", "example:")):
            continue
        if not name:
            raise SpreadsheetImportError(f"Projects, שורה {row_number}: שם הפרויקט הוא שדה חובה.")
        normalized_name = name.casefold()
        if normalized_name in project_names:
            raise SpreadsheetImportError(f"Projects, שורה {row_number}: שם פרויקט כפול ({name}).")
        project_names.add(normalized_name)
        try:
            payload = ProjectCreate(
                name=name,
                description=record.get("description") or None,
                icon=record.get("icon") or None,
            )
        except ValidationError as exc:
            raise SpreadsheetImportError(
                f"Projects, שורה {row_number}: פרטי הפרויקט אינם תקינים."
            ) from exc
        projects.append((row_number, normalized_name, payload))

    links: list[tuple[int, str, LinkCreate]] = []
    for row_number, record in link_records:
        project_name = record.get("project_name", "").strip()
        if project_name.casefold().startswith(("דוגמה:", "example:")):
            continue
        normalized_name = project_name.casefold()
        if normalized_name not in project_names:
            displayed_name = project_name or "ריק"
            raise SpreadsheetImportError(
                f"Links, שורה {row_number}: שם הפרויקט אינו קיים "
                f"בלשונית Projects ({displayed_name})."
            )
        tags = [tag.strip() for tag in record.get("tags", "").split(",") if tag.strip()]
        try:
            payload = LinkCreate(
                title=record.get("link_title", ""),
                url=record.get("url", ""),
                category=record.get("category") or "other",
                tags=tags,
            )
        except ValidationError as exc:
            raise SpreadsheetImportError(
                f"Links, שורה {row_number}: פרטי הקישור אינם תקינים."
            ) from exc
        links.append((row_number, normalized_name, payload))

    if not projects:
        raise SpreadsheetImportError(
            "לא נמצאו פרויקטים לייבוא. יש למלא לפחות שורה אחת בלשונית Projects."
        )
    return ParsedWorkbook(projects=projects, links=links)


async def import_workbook(
    data: bytes,
    workspace_id: UUID,
    user_id: UUID,
    projects: ProjectService,
    links: LinkService,
) -> dict[str, int]:
    parsed = parse_workbook(data)
    created_projects: dict[str, UUID] = {}
    for _, key, payload in parsed.projects:
        created = await projects.create(
            payload.model_copy(update={"workspace_id": workspace_id}), user_id
        )
        created_projects[key] = created.id
    for _, key, payload in parsed.links:
        await links.create_for_project(created_projects[key], payload, user_id)
    return {"projects_created": len(parsed.projects), "links_created": len(parsed.links)}
