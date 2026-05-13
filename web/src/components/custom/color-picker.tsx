import { HexColorPicker } from "react-colorful"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

function normalizeHexColor(color: string): string {
  return color.toUpperCase()
}

const ColorPicker = ({ value, onChange }: ColorPickerProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="h-8 w-8 rounded-full border shadow-sm"
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>

      <PopoverContent className="w-auto p-3">
        <HexColorPicker color={value} onChange={(color) => onChange(normalizeHexColor(color))} />
      </PopoverContent>
    </Popover>
  )
}
export default ColorPicker
