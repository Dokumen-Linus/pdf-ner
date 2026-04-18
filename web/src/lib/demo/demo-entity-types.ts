import { m } from "@/integrations/paraglide/messages.js"

import type { EntityType } from "@/components/entity-table/entity-type"

const demoETNames: Pick<EntityType, "name">[] = [
  { name: m.entity_type_register_id() },
  { name: m.entity_type_register_volume() },
  { name: m.entity_type_register_number() },
  { name: m.entity_type_register_date() },
  { name: m.entity_type_effective_date() },
  { name: m.entity_type_title() },
  { name: m.entity_type_agency() },
  { name: m.entity_type_action() },
  { name: m.entity_type_summary() },
  { name: m.entity_type_contact_name() },
  { name: m.entity_type_contact_position() },
  { name: m.entity_type_contact_email() },
]

const demoETSubtypes: ("highlight" | "underline" | "squiggly")[] = []
for (let i = 0; i < demoETNames.length; i++) {
  const r = Math.random()
  demoETSubtypes.push(r < 0.75 ? "highlight" : r < 0.9 ? "underline" : "squiggly")
}

const demoETOpacity: Record<"highlight" | "underline" | "squiggly", number> = {
  highlight: Math.random() * 0.2 + 0.6,
  underline: 1,
  squiggly: 1,
}

const demoColors = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
]

const demoETColors: string[] = []
for (let i = 0; i < demoETNames.length; i++) {
  demoETColors.push(demoColors[Math.floor(Math.random() * demoColors.length)])
}

const demoEntityTypes: EntityType[] = []
for (let i = 0; i < demoETNames.length; i++) {
  demoEntityTypes.push({
    name: demoETNames[i].name,
    subtype: demoETSubtypes[i],
    color: demoETColors[i],
    opacity: demoETOpacity[demoETSubtypes[i]],
    unique: true,
    required: true,
  })
}

export default demoEntityTypes
