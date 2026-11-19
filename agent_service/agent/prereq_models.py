from typing import List, Literal, Union

from pydantic import BaseModel, Field


class CourseOption(BaseModel):
    type: Literal["COURSE"] = "COURSE"
    course: str = Field(description="The course code or prerequisite requirement string")


class OrGroup(BaseModel):
    type: Literal["OR"] = "OR"
    options: List[Union[CourseOption, "AndGroup", "OrGroup"]]


class AndGroup(BaseModel):
    type: Literal["AND"] = "AND"
    courses: List[Union[str, CourseOption, OrGroup, "AndGroup"]]


class Prerequisite(BaseModel):
    root_group: Union[AndGroup, OrGroup, CourseOption]


OrGroup.model_rebuild()
AndGroup.model_rebuild()
