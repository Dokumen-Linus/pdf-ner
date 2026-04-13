import type { EntityType } from "./entity-type"
import { m } from "@/integrations/paraglide/messages.js"

const initialEntityTypes0: Pick<EntityType, "name" | "subtype">[] = [
  {
    name: m.entity_type_register_id(),
    subtype: "highlight",
  },
  {
    name: m.entity_type_register_volume(),
    subtype: "underline",
  },
  {
    name: m.entity_type_register_number(),
    subtype: "underline",
  },
  {
    name: m.entity_type_register_date(),
    subtype: "highlight",
  },
  {
    name: m.entity_type_effective_date(),
    subtype: "highlight",
  },
  {
    name: m.entity_type_title(),
    subtype: "highlight",
  },
  {
    name: m.entity_type_agency(),
    subtype: "highlight",
  },
  {
    name: m.entity_type_action(),
    subtype: "highlight",
  },
  {
    name: m.entity_type_summary(),
    subtype: "squiggly",
  },
  {
    name: m.entity_type_contact_name(),
    subtype: "highlight",
  },
  {
    name: m.entity_type_contact_position(),
    subtype: "highlight",
  },
  {
    name: m.entity_type_contact_email(),
    subtype: "highlight",
  },
]

const initialColors = [
  "#FFEB3B", // Bright Yellow
  "#FF9800", // Orange
  "#FF5722", // Deep Orange
  "#FF4081", // Hot Pink
  "#E040FB", // Purple
  "#7C4DFF", // Electric Violet
  "#536DFE", // Indigo
  "#40C4FF", // Light Blue
  "#00E5FF", // Cyan
  "#69F0AE", // Mint Green
]

const initialEntityTypes: EntityType[] = []
for (const initialEntityType of initialEntityTypes0) {
  initialEntityTypes.push({
    ...initialEntityType,
    color: initialColors[Math.floor(Math.random() * initialColors.length)] || "#FFEB3B",
    opacity: initialEntityType.subtype === "highlight" ? Math.random() * 0.2 + 0.6 : 1,
    unique: true,
    required: true,
  })
}
export default initialEntityTypes
