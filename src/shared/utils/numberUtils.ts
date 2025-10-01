import React from 'react';

/**
 * Utilities for handling number formatting in the application
 * Handles Spanish/Latin American decimal comma format (,) vs standard dot format (.)
 */

/**
 * Formats a number from user input to standardized format for database
 * Converts comma decimal separator to dot separator
 * @param value - The input value from user (string)
 * @returns standardized number or 0 if invalid
 */
export const parseNumberInput = (value: string): number => {
  if (!value || value.trim() === '') {
    return 0;
  }

  // Replace comma with dot for decimal separator
  const normalizedValue = value.replace(',', '.');

  // Parse as float
  const parsed = parseFloat(normalizedValue);

  // Return 0 if parsing failed (NaN)
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Formats a number from user input to standardized format, allowing undefined/null
 * Useful for optional numeric fields
 * @param value - The input value from user (string)
 * @returns standardized number, undefined if empty, or 0 if invalid
 */
export const parseOptionalNumberInput = (value: string): number | undefined => {
  if (!value || value.trim() === '') {
    return undefined;
  }

  // Replace comma with dot for decimal separator
  const normalizedValue = value.replace(',', '.');

  // Parse as float
  const parsed = parseFloat(normalizedValue);

  // Return undefined if parsing failed (NaN)
  return isNaN(parsed) ? undefined : parsed;
};

/**
 * Formats a number for display to user
 * Currently returns as-is, but can be extended for localization
 * @param value - The number to format
 * @returns formatted string
 */
export const formatNumberForDisplay = (value: number | undefined | null): string => {
  if (value === undefined || value === null) {
    return '';
  }

  return value.toString();
};

/**
 * Validates that a string represents a valid number (allowing comma as decimal)
 * @param value - The string to validate
 * @returns true if valid number format
 */
export const isValidNumberInput = (value: string): boolean => {
  if (!value || value.trim() === '') {
    return true; // Empty is valid
  }

  // Allow comma as decimal separator
  const normalizedValue = value.replace(',', '.');

  // Check if it's a valid number
  return !isNaN(parseFloat(normalizedValue)) && isFinite(parseFloat(normalizedValue));
};

/**
 * Custom hook for handling numeric input with comma/dot conversion
 * @param initialValue - Initial numeric value
 * @param allowEmpty - Whether to allow empty values (returns undefined)
 * @returns object with value, displayValue, and onChange handler
 */
export const useNumericInput = (
  initialValue: number | undefined = undefined,
  allowEmpty: boolean = false
) => {
  const [displayValue, setDisplayValue] = React.useState<string>(
    formatNumberForDisplay(initialValue)
  );

  const numericValue = allowEmpty
    ? parseOptionalNumberInput(displayValue)
    : parseNumberInput(displayValue);

  const handleChange = (newValue: string) => {
    // Allow the user to type comma or dot
    setDisplayValue(newValue);
  };

  const reset = (newValue: number | undefined = undefined) => {
    setDisplayValue(formatNumberForDisplay(newValue));
  };

  return {
    displayValue,
    numericValue,
    onChange: handleChange,
    reset,
    isValid: isValidNumberInput(displayValue)
  };
};

