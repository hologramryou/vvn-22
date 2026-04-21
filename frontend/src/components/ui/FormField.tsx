import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

interface BaseProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
}

type InputProps = BaseProps & { as?: 'input' } & InputHTMLAttributes<HTMLInputElement>
type SelectProps = BaseProps & { as: 'select'; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>
type TextareaProps = BaseProps & { as: 'textarea' } & TextareaHTMLAttributes<HTMLTextAreaElement>

type FormFieldProps = InputProps | SelectProps | TextareaProps

const inputBase =
  'w-full rounded-lg border px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors'
const inputNormal = 'border-slate-200 focus:border-blue-400 focus:ring-blue-100'
const inputError  = 'border-red-300 focus:border-red-400 focus:ring-red-100'

export function FormField(props: FormFieldProps) {
  const { label, error, hint, required, as = 'input', ...rest } = props

  const fieldClass = `${inputBase} ${error ? inputError : inputNormal}`

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      {as === 'textarea' ? (
        <textarea
          className={`${fieldClass} resize-none`}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : as === 'select' ? (
        <select
          className={fieldClass}
          {...(rest as SelectHTMLAttributes<HTMLSelectElement>)}
        >
          {(props as SelectProps).children}
        </select>
      ) : (
        <input
          className={fieldClass}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}

      {hint && !error && <p className="text-[11px] text-slate-400">{hint}</p>}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  )
}
