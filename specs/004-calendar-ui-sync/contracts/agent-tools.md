# Contract: Agent Schedule Tools & MCP Policy

**Feature**: `specs/004-calendar-ui-sync`  
**Service**: Django Agent Service (`agent_service/`)  

---

## 1. Schedule Mutation Tools (Django -> Node)

### Tool: `create_class_event`
Enables Sammy the Slug to add a scheduled course section to the student's local calendar.

- **Signature**:
  ```python
  @tool
  def create_class_event(course_code: str, section: str = "01") -> str:
      """
      Adds a course lecture section to the student's schedule by querying course details 
      from academic_catalog.db and posting to Node POST /api/user_schedule.
      
      Args:
          course_code: Course code (e.g. 'CSE 30', 'CSE 101')
          section: Section identifier (e.g. '01', '02')
          
      Returns:
          Human-readable confirmation message or error details.
      """
  ```
- **Execution Workflow**:
  1. Retrieves meeting days, times, and title from local SQLite `academic_catalog.db` via `catalog_dao.py`.
  2. Constructs `CreateScheduleEventDTO`.
  3. Sends HTTP `POST http://localhost:3000/api/user_schedule` passing student session token (forwarded by Node when user prompted agent).
  4. Returns confirmation: `"Successfully added CSE 30 (MWF 10:00-11:05) to your schedule."`

---

### Tool: `delete_class_event`
Enables Sammy the Slug to remove a scheduled course from the student's local calendar.

- **Signature**:
  ```python
  @tool
  def delete_class_event(course_code: str) -> str:
      """
      Removes a course from the student's schedule by calling Node DELETE /api/user_schedule/:id.
      
      Args:
          course_code: Course code to remove (e.g. 'CSE 30')
          
      Returns:
          Confirmation message or error.
      """
  ```

---

## 2. Google MCP Server & Read-Only Tool Binding

### Policy
The LangGraph/LangChain agent is strictly prohibited from executing mutations directly on Google Calendar.

| Tool Name | Tool Status | Enforcement |
|---|---|---|
| `list_google_events` | Allowed (Read-Only) | Queries Google Calendar free/busy blocks to detect conflicts. |
| `find_free_time` | Allowed (Read-Only) | Identifies available schedule slots. |
| `create_event` | **FORBIDDEN** | Excluded from tool registry; blocked by schema validation. |
| `update_event` | **FORBIDDEN** | Excluded from tool registry; blocked by schema validation. |
| `delete_event` | **FORBIDDEN** | Excluded from tool registry; blocked by schema validation. |

### System Prompt Directive
```text
You can inspect the student's Google Calendar commitments to detect schedule conflicts.
You are strictly forbidden from modifying Google Calendar directly.
To add or remove courses from the student's schedule, you MUST exclusively use the local tools:
`create_class_event` and `delete_class_event`.
All schedule changes are saved locally first before asynchronous synchronization.
```
