from dataclasses import dataclass
from enum import Enum
from typing import Any, List, Optional, Union


class ConditionOperator(Enum):
    """Supported condition operators."""

    SLICE = "slice"
    IN = "in"
    NOT_IN = "not_in"
    RANGE = "range"


@dataclass
class Condition:
    """A condition for filtering or slicing data."""

    # The name of the field to evaluate
    field_name: str
    # The operator to apply (slice, in, not_in, range)
    operator: Union[ConditionOperator, str]
    # values: The values for the operation:
    # - For 'slice': no values
    # - For 'in'/'not_in': list of values to check membership
    # - For 'range': tuple (min_val, max_val) where either can be None
    values: Optional[Union[List[Any], tuple]] = None

    def __post_init__(self):
        """Post-initialization validation and conversion."""
        # Convert string operator to enum
        if isinstance(self.operator, str):
            self.operator = ConditionOperator(self.operator)

        # Validate the condition
        self._validate()

    def _validate(self):
        """Validate the condition parameters."""
        if self.operator == ConditionOperator.SLICE:
            if self.values is not None:
                raise ValueError("For 'slice' operator, no values should be given")

        elif self.operator in (ConditionOperator.IN, ConditionOperator.NOT_IN):
            if self.values is None:
                raise ValueError(f"For '{self.operator.value}' operator, values cannot be None")
            if not isinstance(self.values, (list, tuple, set)):
                raise ValueError(f"For '{self.operator.value}' operator, values must be a list, tuple, or set")

        elif self.operator == ConditionOperator.RANGE:
            if self.values is not None and not isinstance(self.values, (tuple, list)):
                raise ValueError("For 'range' operator, values must be a tuple or list of (min_val, max_val)")
            if self.values is not None and len(self.values) != 2:
                raise ValueError("For 'range' operator, values must contain exactly 2 elements")

    def check(self, field_value: Any) -> bool:
        """Evaluate the condition against an object.

        Args:
        ----
            field_value: Field value

        Returns:
        -------
            True if the condition is met, False otherwise

        """
        if self.operator == ConditionOperator.SLICE:
            print("Evaluation is not supported for SLICE condition.")
            exit(1)
        elif self.operator == ConditionOperator.IN and self.values:
            return field_value in self.values
        elif self.operator == ConditionOperator.NOT_IN and self.values:
            return field_value not in self.values
        elif self.operator == ConditionOperator.RANGE:
            return self._check_range(field_value)

        return False

    def _check_range(self, field_value: Any) -> bool:
        """Evaluate range condition."""
        if not self.values:
            return True  # No range specified, always true

        min_val, max_val = self.values

        try:
            # Check minimum bound
            if min_val is not None and field_value < min_val:
                return False

            # Check maximum bound
            if max_val is not None and field_value > max_val:
                return False

            return True
        except TypeError:
            # field_value is not comparable
            return False

    def operator_str(self) -> str:
        """String representation of operator."""
        return self.operator if isinstance(self.operator, str) else self.operator.value

    def to_dict(self) -> dict:
        """Convert to dictionary representation."""
        return {"field_name": self.field_name, "operator": self.operator_str(), "values": self.values}

    def __str__(self) -> str:
        """String representation of the condition in parseable format."""
        if self.operator == ConditionOperator.SLICE:
            return f"{self.field_name}"

        # Format values to match parse_conditions format
        if self.operator in (ConditionOperator.IN, ConditionOperator.NOT_IN):
            # Join values with commas
            if self.values:
                values_str = ",".join(str(v) for v in self.values)
            else:
                values_str = ""
            return f"{self.field_name}:{self.operator_str()}:{values_str}"

        elif self.operator == ConditionOperator.RANGE:
            # Format range as min:max
            if self.values:
                min_val, max_val = self.values
                min_str = str(min_val) if min_val is not None else ""
                max_str = str(max_val) if max_val is not None else ""
                values_str = f"{min_str}:{max_str}"
            else:
                values_str = ":"
            return f"{self.field_name}:{self.operator.value}:{values_str}"

        # Fallback for any other operators
        return f"{self.field_name}:{self.operator_str()}:{self.values}"


# Convenience factory functions
def slice_condition(field_name: str) -> Condition:
    """Create a slice condition."""
    return Condition(field_name, ConditionOperator.SLICE)


def in_condition(field_name: str, values: List[Any]) -> Condition:
    """Create an 'in' condition."""
    return Condition(field_name, ConditionOperator.IN, values)


def not_in_condition(field_name: str, values: List[Any]) -> Condition:
    """Create a 'not in' condition."""
    return Condition(field_name, ConditionOperator.NOT_IN, values)


def range_condition(field_name: str, min_val: Optional[Any] = None, max_val: Optional[Any] = None) -> Condition:
    """Create a range condition."""
    return Condition(field_name, ConditionOperator.RANGE, (min_val, max_val))


def parse_conditions(conditions_str: str) -> List[Condition]:
    """Parse condition strings into Condition objects.

    Expected format: "field1:operator:values;field2:operator:values"

    Examples
    --------
        "agent_name"  # slice
        "agent_name:in:agent1,agent2,agent3"
        "model:not_in:gpt-3.5;author:in:user1,user2"
        "value:range:10:100"
        "value:range:10:"  # min only
        "value:range::100"  # max only

    """
    conditions: List[Condition] = []

    if not conditions_str.strip():
        return conditions

    # Split by semicolon for multiple conditions
    condition_parts = conditions_str.split(";")

    for part in condition_parts:
        part = part.strip()
        if not part:
            continue

        try:
            # Parse each condition: field:operator:values
            components = part.split(":", 2)  # Split into max 3 parts
            if len(components) == 1:
                conditions.append(slice_condition(components[0]))
                continue

            field_name = components[0].strip()
            operator = components[1].strip()
            values_str = components[2].strip() if len(components) > 2 else ""

            condition = create_condition(field_name, operator, values_str)
            if condition:
                conditions.append(condition)

        except Exception as e:
            print(f"ERROR: Failed to parse condition '{part}': {e}")
            continue

    return conditions


def parse_condition_list(condition_list: List[str]) -> List[Condition]:
    """Parse a list of Condition objects and condition strings into Condition objects."""
    conditions: List[Condition] = []
    for condition in condition_list:
        conditions = conditions + parse_conditions(condition)
    return conditions


def create_condition(field_name: str, operator: str, values_str: str) -> Optional[Condition]:
    """Create a Condition object from parsed components."""
    try:
        if operator == "in":
            if not values_str:
                print(f"ERROR: 'in' operator requires values for field '{field_name}'")
                return None
            values = [v.strip() for v in values_str.split(",") if v.strip()]
            return in_condition(field_name, values)

        elif operator == "not_in":
            if not values_str:
                print(f"ERROR: 'not_in' operator requires values for field '{field_name}'")
                return None
            values = [v.strip() for v in values_str.split(",") if v.strip()]
            return not_in_condition(field_name, values)

        elif operator == "range":
            # Parse range parameters: min:max
            range_parts = values_str.split(":") if values_str else ["", ""]
            min_val: Any = None
            max_val: Any = None

            if len(range_parts) >= 1 and range_parts[0]:
                try:
                    min_val = float(range_parts[0])
                except ValueError:
                    min_val = range_parts[0]  # Keep as string for string comparisons

            if len(range_parts) >= 2 and range_parts[1]:
                try:
                    max_val = float(range_parts[1])
                except ValueError:
                    max_val = range_parts[1]  # Keep as string for string comparisons

            return range_condition(field_name, min_val, max_val)

        else:
            print(f"ERROR: Unknown operator '{operator}' for field '{field_name}'")
            return None

    except ValueError as e:
        print(f"ERROR: Invalid values for '{field_name}:{operator}:{values_str}': {e}")
        return None
