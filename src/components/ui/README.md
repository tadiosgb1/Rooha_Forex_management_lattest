# Shared UI components

Reusable Vue 3 UI primitives for the FX Control frontend. Components live in `src/components/ui` and use the established application palette and visual language.

## Component inventory

| Component | Purpose |
| --- | --- |
| `BaseButton` | Primary, secondary, danger, and ghost actions; small, medium, and large sizes |
| `BaseIconButton` | Accessible icon-only actions with a required label |
| `BaseCard` | Shared surface wrapper; supports `as` and `padded` |
| `BaseBadge` | Neutral, success, warning, danger, and info status badges |
| `BaseInput` | Text, number, password, date, and other native input types; label, hint, error, size, required, and disabled attributes |
| `BaseSelect` | Native select with options, placeholder, label, hint, and error |
| `BaseTextarea` | Multiline input with label, hint, error, and row count |
| `BaseCheckbox` | Controlled checkbox with disabled and error states |
| `BaseAlert` | Informational, success, warning, and error feedback; optional dismiss action |
| `BaseEmptyState` | Empty, missing, and no-results states with optional actions |
| `BasePageHeader` | Consistent page title and action area |
| `BaseStatCard` | Metric card, with optional icon, tone, detail, and interactive button mode |
| `BaseTable` | Reusable responsive table with cell/header/action slots and an empty state |
| `BaseModal` | Dialog with size options, Escape/backdrop close controls, and header/body/footer slots |
| `BaseSpinner` | Loading indicator with size and accessible label |
| `BaseDivider` | Horizontal or vertical separator, optionally labeled |
| `BaseSkeleton` | Text, title, avatar, card, and button loading placeholders |
| `BasePagination` | Controlled page navigation with boundary and disabled states |

## Importing

Import directly from a component file, or use the shared barrel exports:

```js
import { BaseButton, BaseCard, BaseInput, BaseTable } from '../components/ui'
```

From a file under `src/views`, the relative import above works without configuring a Vite alias. From other folders, adjust the relative path or import the individual component.

## Examples

### Actions

```vue
<BaseButton type="submit">Save changes</BaseButton>
<BaseButton variant="secondary" @click="cancel">Cancel</BaseButton>
<BaseButton variant="danger" @click="removeRecord">Delete</BaseButton>
<BaseIconButton label="Close panel" @click="closePanel">×</BaseIconButton>
```

### Fields and validation feedback

```vue
<BaseInput v-model="form.reference" label="Reference" required hint="Enter the bank reference." />
<BaseInput v-model="form.amount" label="Amount" type="number" :error="amountError" />
<BaseSelect v-model="form.status" label="Status" :options="statusOptions" required />
<BaseTextarea v-model="form.reason" label="Reason" :rows="4" />
<BaseCheckbox v-model="form.confirmed">I confirm the information is correct.</BaseCheckbox>
```

### Table

```vue
<BaseTable :columns="columns" :rows="rows" row-key="id">
  <template #cell="{ row, column, value }">
    {{ value ?? '—' }}
  </template>
  <template #actions="{ row }">
    <BaseButton size="sm" variant="ghost" @click="view(row)">View</BaseButton>
  </template>
</BaseTable>
```

### Dialog

```vue
<BaseModal v-model="confirmOpen" title="Confirm action" size="sm">
  <p>Are you sure you want to continue?</p>
  <template #footer>
    <BaseButton variant="secondary" @click="confirmOpen = false">Cancel</BaseButton>
    <BaseButton variant="danger" @click="confirmAction">Confirm</BaseButton>
  </template>
</BaseModal>
```

## Conventions

- Prefer these components over one-off buttons, form controls, cards, and badges in page templates.
- Keep module-specific layout classes when adopting shared components so the existing design is preserved.
- Pass an accessible label to icon-only controls and use real labels for inputs.
- Use `v-model` for controlled field values and show validation through the `error` prop.
- Keep business logic and data fetching in the page or store, not inside presentational components.
- Extend shared component props and styles only when the capability is useful across multiple pages.
