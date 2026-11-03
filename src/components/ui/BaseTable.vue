<script setup>
import BaseEmptyState from './BaseEmptyState.vue'
defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, default: () => [] },
  rowKey: { type: String, default: 'id' },
  emptyTitle: { type: String, default: 'No records found' },
  emptyMessage: { type: String, default: 'Try adjusting your search or create a new record.' },
  wrapperClass: { type: String, default: '' },
  tableClass: { type: String, default: '' },
  actionsHeaderClass: { type: String, default: '' },
  actionsCellClass: { type: String, default: '' },
})
</script>
<template>
  <div :class="['ui-table-wrap', wrapperClass]">
    <table :class="['ui-table', tableClass]">
      <thead><tr><th v-for="column in columns" :key="column.key" :class="column.headerClass">{{ column.label }}<slot :name="'header-' + column.key" :column="column" /></th><th v-if="$slots.actions" :class="['ui-table-actions-head', actionsHeaderClass]">Actions</th></tr></thead>
      <tbody>
        <tr v-for="row in rows" :key="row[rowKey]">
          <td v-for="column in columns" :key="column.key" :class="column.cellClass"><slot name="cell" :row="row" :column="column" :value="row[column.key]">{{ row[column.key] ?? '—' }}</slot></td>
          <td v-if="$slots.actions" :class="['ui-table-actions', actionsCellClass]"><slot name="actions" :row="row" /></td>
        </tr>
        <tr v-if="!rows.length"><td :colspan="columns.length + ($slots.actions ? 1 : 0)" class="ui-table-empty"><BaseEmptyState :title="emptyTitle" :description="emptyMessage" /></td></tr>
      </tbody>
    </table>
  </div>
</template>
