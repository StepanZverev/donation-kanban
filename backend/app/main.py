from fastapi import FastAPI

app = FastAPI(title="Donation Kanban")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
