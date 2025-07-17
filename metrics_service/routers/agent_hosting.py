"""API endpoints for agent hosting operations."""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from metrics_service.utils.cache import metrics_cache

router = APIRouter(prefix="/agent-hosting", tags=["agent-hosting"])

logger = logging.getLogger(__name__)


class DefaultFilterRequest(BaseModel):
    """Request model for default filter."""

    user_id: Optional[str] = Field(None, description="User ID for filtering")
    owner_organization: Optional[str] = Field(None, description="Owner organization for filtering")

    class Config:
        """Pydantic config."""

        json_schema_extra = {
            "example": {
                "user_id": "user123",
                "owner_organization": "my-org"
            }
        }


class AgentsRequest(BaseModel):
    """Request model for agents."""

    user_id: Optional[str] = Field(None, description="User ID (ignored for now)")
    owner_organization: Optional[str] = Field(None, description="Owner organization for filtering")

    class Config:
        """Pydantic config."""

        json_schema_extra = {
            "example": {
                "owner_organization": "my-org"
            }
        }


class InstancesRequest(BaseModel):
    """Request model for instances."""

    user_id: Optional[str] = Field(None, description="User ID for filtering")
    owner_organization: Optional[str] = Field(None, description="Owner organization (ignored for now)")

    class Config:
        """Pydantic config."""

        json_schema_extra = {
            "example": {
                "user_id": "user123"
            }
        }


@router.post("/default_filter", response_model=Dict[str, Any])
async def get_default_filter(request: DefaultFilterRequest):
    """Get global filter based on user_id and owner_organization.

    Logic:
    - Empty arguments -> empty filter
    - If owner_organization is present, and filtering entries by owner_organization is non-empty,
      return owner_organization filter
    - Otherwise, return user_id filter
    """
    try:
        logger.info(f"Default filter request received: {request}")

        # Get agent hosting analytics data
        agent_hosting_analytics = metrics_cache.get_agent_hosting_analytics()
        if agent_hosting_analytics is None:
            raise HTTPException(
                status_code=503,
                detail="Agent hosting not configured. Set both AGENT_HOSTING_URL and AGENT_HOSTING_API_KEY."
            )

        # Empty arguments -> empty filter
        if not request.user_id and not request.owner_organization:
            return {}

        # If owner_organization is present, check if filtering by it would return non-empty results
        if request.owner_organization:
            filtered_entries = [
                entry for entry in agent_hosting_analytics.entries
                if entry.metadata.get("owner_organization") == request.owner_organization
            ]
            if filtered_entries:
                return {"owner_organization": request.owner_organization}

        # Otherwise, return user_id filter (if provided)
        if request.user_id:
            return {"user_id": request.user_id}

        # If no valid filter can be created, return empty filter
        return {}

    except HTTPException:
        raise  # Re-raise HTTPException without wrapping
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting default filter: {str(e)}")  # noqa: B904


@router.post("/agents", response_model=List[Dict[str, Any]])
async def get_agents(request: AgentsRequest):
    """Get agents, optionally filtered by owner_organization.

    Logic:
    - Empty owner_organization -> all agents
    - Otherwise all agents filtered by owner_organization
    """
    try:
        logger.info(f"Agents request received: {request}")

        # Get agent hosting analytics data
        agent_hosting_analytics = metrics_cache.get_agent_hosting_analytics()
        if agent_hosting_analytics is None:
            raise HTTPException(
                status_code=503,
                detail="Agent hosting not configured. Set both AGENT_HOSTING_URL and AGENT_HOSTING_API_KEY."
            )

        agents = agent_hosting_analytics.agents

        # Apply owner_organization filter if provided
        if request.owner_organization:
            agents = [
                agent for agent in agents
                if agent.get("owner_organization") == request.owner_organization
            ]

        return agents

    except HTTPException:
        raise  # Re-raise HTTPException without wrapping
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting agents: {str(e)}")  # noqa: B904


@router.post("/instances", response_model=List[Dict[str, Any]])
async def get_instances(request: InstancesRequest):
    """Get instances, optionally filtered by user_id.

    Logic:
    - Empty user_id -> all instances
    - Otherwise all instances filtered by user_id
    """
    try:
        logger.info(f"Instances request received: {request}")

        # Get agent hosting analytics data
        agent_hosting_analytics = metrics_cache.get_agent_hosting_analytics()
        if agent_hosting_analytics is None:
            raise HTTPException(
                status_code=503,
                detail="Agent hosting not configured. Set both AGENT_HOSTING_URL and AGENT_HOSTING_API_KEY."
            )

        instances = agent_hosting_analytics.instances

        # Apply user_id filter if provided
        if request.user_id:
            instances = [
                instance for instance in instances
                if instance.get("user_id") == request.user_id
            ]

        return instances

    except HTTPException:
        raise  # Re-raise HTTPException without wrapping
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting instances: {str(e)}")  # noqa: B904


@router.get("/schema")
async def get_schema():
    """Get the schema information for agent-hosting endpoints."""
    return {
        "default_filter": {
            "description": "Get global filter based on user_id and owner_organization",
            "logic": [
                "Empty arguments -> empty filter",
                "If owner_organization present and has entries -> return owner_organization filter",
                "Otherwise -> return user_id filter"
            ],
            "parameters": {
                "user_id": "Optional user ID for filtering",
                "owner_organization": "Optional organization name for filtering"
            },
            "response": "Filter object that can be passed to Dashboard component"
        },
        "agents": {
            "description": "Get agents, optionally filtered by owner_organization",
            "logic": [
                "Empty owner_organization -> all agents",
                "Otherwise -> agents filtered by owner_organization"
            ],
            "parameters": {
                "user_id": "Optional user ID (ignored for now)",
                "owner_organization": "Optional organization name for filtering agents"
            },
            "response": "List of agent objects"
        },
        "instances": {
            "description": "Get instances, optionally filtered by user_id",
            "logic": [
                "Empty user_id -> all instances",
                "Otherwise -> instances filtered by user_id"
            ],
            "parameters": {
                "user_id": "Optional user ID for filtering instances",
                "owner_organization": "Optional organization name (ignored for now)"
            },
            "response": "List of instance objects"
        }
    }
