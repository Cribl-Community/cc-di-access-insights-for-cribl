import { TextField } from '@capra/core';
import { SearchOutlined } from '@capra/icons';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label': string;
}

export function SearchField({ value, onChange, placeholder, 'aria-label': ariaLabel }: SearchFieldProps) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={ariaLabel}
      leadingSlot={<SearchOutlined />}
    />
  );
}
