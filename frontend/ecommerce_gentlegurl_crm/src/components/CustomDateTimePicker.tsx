interface Props {
  label: string;
  value?: string; // e.g. "2025-06-29 15:00:00" or just "15:00:00"
  onChange: (val: string) => void;
  showDate?: boolean;
  borderColor?: string;
  required?: boolean;
}

export default function CustomDateTimePicker({
  label,
  value = '00:00:00',
  onChange,
  showDate = true,
  borderColor = 'gray-300',
  required = true,
}: Props) {
  const pad = (n: number) => n.toString().padStart(2, '0');

  const [datePart, timePart] = value.includes(' ')
    ? value.split(' ')
    : ['', value];

  const [hour = 0, minute = 0, second = 0] = (timePart || '00:00:00')
    .split(':')
    .map((v) => Number(v));

  const today = new Date();
  const dateDefault = datePart || today.toISOString().slice(0, 10);

  const inputClass = `border rounded-md p-2 text-sm border-${borderColor}`;

  const handlePartChange = (part: 'hour' | 'minute' | 'second' | 'date', newVal: string) => {
    const newHour = part === 'hour' ? newVal : pad(hour);
    const newMinute = part === 'minute' ? newVal : pad(minute);
    const newSecond = part === 'second' ? newVal : pad(second);
    const newDate = part === 'date' ? newVal : dateDefault;

    const result = showDate
      ? `${newDate} ${newHour}:${newMinute}:${newSecond}`
      : `${newHour}:${newMinute}:${newSecond}`;
    onChange(result);
  };

  return (
    <>
      <label className="block text-sm text-gray-700 mb-1">
        {label} {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {showDate && (
          <input
            type="date"
            value={dateDefault}
            onChange={(e) => handlePartChange('date', e.target.value)}
            className={inputClass}
          />
        )}
        <select
          value={pad(hour)}
          onChange={(e) => handlePartChange('hour', e.target.value)}
          className={inputClass}
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={pad(i)}>
              {pad(i)}
            </option>
          ))}
        </select>
        <span className="self-center">:</span>
        <select
          value={pad(minute)}
          onChange={(e) => handlePartChange('minute', e.target.value)}
          className={inputClass}
        >
          {Array.from({ length: 60 }, (_, i) => (
            <option key={i} value={pad(i)}>
              {pad(i)}
            </option>
          ))}
        </select>
        <span className="self-center">:</span>
        <select
          value={pad(second)}
          onChange={(e) => handlePartChange('second', e.target.value)}
          className={inputClass}
        >
          {Array.from({ length: 60 }, (_, i) => (
            <option key={i} value={pad(i)}>
              {pad(i)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
