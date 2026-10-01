import React, { Children, forwardRef, isValidElement, useEffect, useRef } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import './SelectField.css';

const EMPTY_VALUE = '__rfm_empty__';

function optionEntries(children) {
  return Children.toArray(children).filter(
    child => isValidElement(child) && child.type === 'option',
  );
}

function optionLabel(option) {
  return option?.props?.children ?? option?.props?.value ?? '';
}

function changeEvent(value) {
  return { target: { value }, currentTarget: { value }, type: 'change' };
}

function radixValue(value) {
  return String(value ?? '') === '' ? EMPTY_VALUE : String(value);
}

const SelectField = forwardRef(function SelectField(
  {
    className = '',
    children,
    value,
    defaultValue,
    onChange,
    onValueChange,
    placeholder,
    disabled,
    name,
    required,
    ...triggerProps
  },
  ref,
) {
  const triggerRef = useRef(null);
  const options = optionEntries(children);
  const selectedValue = value == null ? undefined : String(value);
  const selectedOption = options.find(option => String(option.props.value ?? '') === selectedValue);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger || !onChange) return undefined;
    const handleNativeChange = event => {
      const nextValue = event.target?.value;
      if (nextValue == null || nextValue === selectedValue) return;
      onChange(changeEvent(String(nextValue)));
      onValueChange?.(String(nextValue));
    };
    trigger.addEventListener('change', handleNativeChange);
    return () => trigger.removeEventListener('change', handleNativeChange);
  }, [onChange, onValueChange, selectedValue]);

  const setTriggerRef = node => {
    triggerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <Select.Root
      value={selectedValue == null ? undefined : radixValue(selectedValue)}
      defaultValue={defaultValue == null ? undefined : radixValue(defaultValue)}
      onValueChange={nextValue => {
        const normalizedValue = nextValue === EMPTY_VALUE ? '' : nextValue;
        onChange?.(changeEvent(normalizedValue));
        onValueChange?.(normalizedValue);
      }}
      disabled={disabled}
      name={name}
      required={required}
    >
      <Select.Trigger
        {...triggerProps}
        ref={setTriggerRef}
        value={selectedValue || ''}
        onChange={event => onChange?.(event)}
        className={`select-field ${className}`.trim()}
        disabled={disabled}
      >
        <Select.Value placeholder={placeholder ?? optionLabel(selectedOption)} />
        <Select.Icon aria-hidden="true">
          <ChevronDown size={16} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="select-field-content" position="popper" sideOffset={4}>
          <Select.Viewport className="select-field-viewport">
            {options.map(option => {
              const optionValue = String(option.props.value ?? '');
              return (
                <Select.Item
                  key={option.key ?? optionValue}
                  value={radixValue(optionValue)}
                  disabled={option.props.disabled}
                  className="select-field-item"
                >
                  <Select.ItemText>{optionLabel(option)}</Select.ItemText>
                  <Select.ItemIndicator className="select-field-item-indicator">
                    <Check size={14} />
                  </Select.ItemIndicator>
                </Select.Item>
              );
            })}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
});

export default SelectField;
