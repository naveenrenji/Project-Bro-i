"""
Formatting utilities for the CPE Funnel Dashboard.
"""

from typing import Tuple


def format_currency(value: float, show_cents: bool = False) -> str:
    """Format a number as USD currency."""
    if value is None:
        return "$0"
    if show_cents:
        return f"${value:,.2f}"
    return f"${value:,.0f}"


def format_percent(value: float, decimals: int = 0) -> str:
    """Format a number as a percentage. Default to whole numbers for cleaner display."""
    if value is None:
        return "0%"
    if decimals == 0:
        return f"{int(round(value))}%"
    return f"{value:.{decimals}f}%"


def format_number(value: float, decimals: int = 0) -> str:
    """Format a number with thousand separators."""
    if value is None:
        return "0"
    if decimals == 0:
        return f"{int(value):,}"
    return f"{value:,.{decimals}f}"


def format_delta(current: float, previous: float, show_vs: bool = True) -> Tuple[str, str]:
    """
    Calculate and format the change between two values.
    Returns (formatted_change, direction) where direction is 'up', 'down', or 'flat'.
    """
    if previous == 0:
        if current > 0:
            return "N/A vs 2025" if show_vs else "N/A", "up"
        return "N/A vs 2025" if show_vs else "N/A", "flat"
    
    change = ((current - previous) / previous) * 100
    change_int = int(round(change))
    
    if change > 0:
        text = f"+{change_int}% vs 2025" if show_vs else f"+{change_int}%"
        return text, "up"
    elif change < 0:
        text = f"{change_int}% vs 2025" if show_vs else f"{change_int}%"
        return text, "down"
    else:
        return "0% vs 2025" if show_vs else "0%", "flat"


def format_delta_value(current: float, previous: float) -> Tuple[str, str]:
    """
    Calculate and format the absolute change between two values.
    Returns (formatted_change, direction).
    """
    change = current - previous
    
    if change > 0:
        return f"+{format_number(change)}", "up"
    elif change < 0:
        return f"{format_number(change)}", "down"
    else:
        return "0", "flat"


def safe_divide(numerator: float, denominator: float, default: float = 0) -> float:
    """Safely divide two numbers, returning default if denominator is zero."""
    if denominator == 0:
        return default
    return numerator / denominator

