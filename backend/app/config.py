from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    monte_carlo_iterations: int = 10000
    cors_origins: str = "http://localhost:5173"


settings = Settings()
