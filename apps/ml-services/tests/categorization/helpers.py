from app.categorization.repository import CategoryRecord


def make_category(
    id: str, name: str, slug: str, parent_id: str | None, parent_name: str | None
) -> CategoryRecord:
    return CategoryRecord(id=id, name=name, slug=slug, parent_id=parent_id, parent_name=parent_name)
