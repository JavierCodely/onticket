import React, { useState, useEffect } from 'react';
import { Input } from '@/shared/components/ui/input';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = "0,00",
  className = "",
  disabled = false,
  error = false
}) => {
  const [displayValue, setDisplayValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);

  // Formatear el valor para mostrar
  const formatCurrency = (num: number): string => {
    if (num === 0) return '';
    return num.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Limpiar y parsear el valor de entrada
  const parseInput = (input: string): number => {
    // Remover todo excepto números, puntos y comas
    const cleaned = input.replace(/[^\d.,]/g, '');

    // Manejar tanto punto como coma como decimal
    let normalized = cleaned;

    // Si hay tanto punto como coma, asumir que el último es decimal
    if (cleaned.includes('.') && cleaned.includes(',')) {
      const lastDot = cleaned.lastIndexOf('.');
      const lastComma = cleaned.lastIndexOf(',');

      if (lastComma > lastDot) {
        // Coma es decimal, punto es separador de miles
        normalized = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // Punto es decimal, coma es separador de miles
        normalized = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      // Solo coma, asumir que es decimal
      normalized = cleaned.replace(',', '.');
    }

    return parseFloat(normalized) || 0;
  };

  // Actualizar display value cuando cambia el value prop
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatCurrency(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);

    const numericValue = parseInput(inputValue);
    onChange(numericValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Al enfocar, mostrar el valor sin formato para facilitar edición
    if (value > 0) {
      setDisplayValue(value.toString().replace('.', ','));
    } else {
      setDisplayValue('');
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const numericValue = parseInput(displayValue);
    onChange(numericValue);
    setDisplayValue(formatCurrency(numericValue));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Permitir solo números, punto, coma, backspace, delete, tab, enter, flechas
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight',
      'ArrowUp', 'ArrowDown', 'Home', 'End', '.', ','
    ];

    const isNumber = /^[0-9]$/.test(e.key);
    const isAllowedKey = allowedKeys.includes(e.key);
    const isCtrlCmd = e.ctrlKey || e.metaKey;

    if (!isNumber && !isAllowedKey && !isCtrlCmd) {
      e.preventDefault();
    }
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
        $
      </span>
      <Input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`pl-8 ${error ? 'border-destructive' : ''} ${className}`}
      />
    </div>
  );
};