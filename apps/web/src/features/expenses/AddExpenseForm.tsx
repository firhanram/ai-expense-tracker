import { Button } from "@ui-sdk/react/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field"
import { Input } from "@ui-sdk/react/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select"
import { Check, ChevronDown } from "lucide-react"
import { type FormEvent, type ReactNode, useState } from "react"
import { categories } from "../../shared/categories/categories.ts"
import { localToday } from "../../shared/format/localDate.ts"
import {
  type ExpenseField,
  type ExpenseFormErrors,
  type ExpenseFormValues,
  errorsFromApi,
  parseExpenseForm,
} from "./expenseForm.ts"
import { useCreateExpense } from "./useCreateExpense.ts"

const control =
  "h-9 w-full rounded-sm border border-line bg-surface px-3 text-md transition-colors duration-(--motion-color) placeholder:text-text-muted hover:border-ring data-invalid:border-danger"

const categoryItems = categories.map((category) => ({
  value: String(category.id),
  label: category.name,
}))

const FormField = ({
  label,
  error,
  description,
  className,
  children,
}: {
  label: string
  error: string | undefined
  description?: string
  className?: string
  children: ReactNode
}) => (
  <Field
    {...(error === undefined ? {} : { invalid: true })}
    className={`flex flex-col gap-1 ${className ?? ""}`}
  >
    <FieldLabel className="text-sm font-medium">{label}</FieldLabel>
    {children}
    {description === undefined ? null : (
      <FieldDescription className="text-xs text-text-muted">{description}</FieldDescription>
    )}
    {error === undefined ? null : (
      <FieldError match className="text-sm text-danger">
        {error}
      </FieldError>
    )}
  </Field>
)

/**
 * The manual way to record an Expense (no agent): it is confirmed on
 * creation. Errors, the client's or the server's, show against their field.
 */
export const AddExpenseForm = ({ onDone }: { onDone: () => void }) => {
  const [values, setValues] = useState<ExpenseFormValues>(() => ({
    amount: "",
    categoryId: null,
    merchant: "",
    note: "",
    occurredAt: localToday(),
  }))
  const [errors, setErrors] = useState<ExpenseFormErrors>({})
  const create = useCreateExpense()

  const edit = (field: ExpenseField, value: string | null) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors(({ [field]: _cleared, form: _form, ...rest }) => rest)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = parseExpenseForm(values)
    if ("errors" in parsed) {
      setErrors(parsed.errors)
      return
    }
    setErrors({})
    create.mutate(parsed.payload, {
      onSuccess: onDone,
      onError: (error) => setErrors(errorsFromApi(error)),
    })
  }

  return (
    <form
      aria-label="Add expense"
      noValidate
      onSubmit={submit}
      className="mt-4 mb-2 grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-2"
    >
      <FormField
        label="Amount"
        error={errors.amount}
        description="Whole Rupiah. Negative for a refund."
      >
        <Input
          inputMode="numeric"
          autoComplete="off"
          placeholder="70000"
          value={values.amount}
          onValueChange={(value) => edit("amount", value)}
          className={`${control} font-num tabular`}
        />
      </FormField>
      <FormField label="Date" error={errors.occurredAt}>
        <Input
          type="date"
          max={localToday()}
          value={values.occurredAt}
          onValueChange={(value) => edit("occurredAt", value)}
          className={control}
        />
      </FormField>
      <FormField label="Category" error={errors.categoryId}>
        <Select
          items={categoryItems}
          placeholder="Pick one"
          value={values.categoryId}
          onValueChange={(value) => edit("categoryId", value)}
        >
          <SelectTrigger
            className={`${control} flex items-center justify-between text-left data-open:border-ring data-open:bg-surface-2 data-placeholder:text-text-muted`}
          >
            <SelectValue />
            <ChevronDown aria-hidden="true" size={14} className="text-text-muted" />
          </SelectTrigger>
          <SelectContent className="max-h-(--available-height) w-(--anchor-width) overflow-auto rounded-lg border border-line bg-surface p-1 shadow-pop">
            {categoryItems.map((item) => (
              <SelectItem
                key={item.value}
                value={item.value}
                className="flex cursor-default items-center justify-between rounded-sm px-2 py-1.5 text-sm data-highlighted:bg-surface-2"
              >
                {item.label}
                <SelectItemIndicator>
                  <Check aria-hidden="true" size={14} />
                </SelectItemIndicator>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Merchant" error={errors.merchant}>
        <Input
          autoComplete="off"
          placeholder="Uniqlo"
          value={values.merchant}
          onValueChange={(value) => edit("merchant", value)}
          className={control}
        />
      </FormField>
      <FormField label="Note" error={errors.note} className="md:col-span-2">
        <Input
          autoComplete="off"
          value={values.note}
          onValueChange={(value) => edit("note", value)}
          className={control}
        />
      </FormField>

      {errors.form === undefined ? null : (
        <p role="alert" className="text-sm text-danger md:col-span-2">
          {errors.form}
        </p>
      )}

      <div className="flex justify-end gap-2 md:col-span-2">
        <Button
          onClick={onDone}
          className="h-9 rounded-sm border border-line bg-surface px-3 text-sm font-medium transition-colors duration-(--motion-color) hover:bg-surface-2"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={create.isPending}
          className="h-9 rounded-sm bg-accent px-3 text-sm font-medium text-accent-fg transition-opacity duration-(--motion-color) hover:opacity-90 data-disabled:opacity-70"
        >
          {create.isPending ? "Adding…" : "Add expense"}
        </Button>
      </div>
    </form>
  )
}
