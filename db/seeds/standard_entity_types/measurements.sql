INSERT INTO public.std_entity_types (
  short_name, long_name, category, definition, examples, format_description, datatype, regex, exact_length, single_word
)
VALUES
(
  'speed', 'Speed', 'measurements',
  'Rate of motion expressed with a numeric value and unit',
  ARRAY['60 mph', '100 km/h', '30 m/s', '5 knots'],
  'Numeric value followed by unit such as mph, km/h, m/s, or knots',
  'float', NULL, NULL, FALSE
),
(
  'weight', 'Weight', 'measurements',
  'Mass or weight expressed with a numeric value and unit',
  ARRAY['150 lbs', '68 kg', '2.5 tons', '500 g'],
  'Numeric value followed by unit such as lbs, kg, g, oz, or tons',
  'float', NULL, NULL, FALSE
),
(
  'length', 'Length, Height, or Width', 'measurements',
  'Linear measurement of length, height, or width with numeric value and unit',
  ARRAY['6 ft', '180 cm', '12 inches', '3.5 m'],
  'Numeric value followed by unit such as ft, in, cm, m, mm, or yd',
  'float', NULL, NULL, FALSE
),
(
  'volume', 'Volume', 'measurements',
  'Three-dimensional measurement of capacity or space with numeric value and unit',
  ARRAY['2 liters', '500 mL', '1 gallon', '3 fl oz'],
  'Numeric value followed by unit such as L, mL, gal, fl oz, or cc',
  'float', NULL, NULL, FALSE
),
(
  'area', 'Area', 'measurements',
  'Two-dimensional measurement of surface size with numeric value and unit',
  ARRAY['100 sq ft', '50 m²', '2 acres', '1,500 square feet'],
  'Numeric value followed by unit such as sq ft, m², acres, or hectares',
  'float', NULL, NULL, FALSE
),
(
  'dimensions', 'Dimensions', 'measurements',
  'Multi-dimensional measurements expressed as width × height × depth or similar',
  ARRAY['10 x 20 x 5 cm', '8.5" x 11"', '24 x 36 inches'],
  'Two or three measurements separated by x or × with optional units',
  NULL, NULL, NULL, FALSE
),
(
  'angle', 'Angle', 'measurements',
  'Rotational measurement expressed in degrees, radians, or gradians',
  ARRAY['45°', '90 degrees', '1.57 rad', '3.14159 radians'],
  'Numeric value followed by degree symbol (°), ''degrees'', ''rad'', or ''radians''',
  'float', NULL, NULL, FALSE
),
(
  'temperature', 'Temperature', 'measurements',
  'Thermal measurement expressed with a numeric value and unit scale',
  ARRAY['98.6°F', '37°C', '310 K', '-40°F'],
  'Numeric value followed by °F, °C, or K; may include negative values',
  'float', NULL, NULL, FALSE
),
(
  'pressure', 'Pressure', 'measurements',
  'Force per unit area expressed with a numeric value and unit',
  ARRAY['30 psi', '1 atm', '101.3 kPa', '760 mmHg'],
  'Numeric value followed by unit such as psi, atm, Pa, kPa, bar, or mmHg',
  'float', NULL, NULL, FALSE
),
(
  'energy', 'Energy', 'measurements',
  'Measure of work or heat capacity expressed with a numeric value and unit',
  ARRAY['100 kWh', '500 J', '1,000 BTU', '2.5 MJ'],
  'Numeric value followed by unit such as J, kJ, kWh, BTU, or cal',
  'float', NULL, NULL, FALSE
),
(
  'current', 'Electric Current', 'measurements',
  'Flow of electric charge expressed in amperes or related units',
  ARRAY['5 A', '100 mA', '2.5 amperes', '500 μA'],
  'Numeric value followed by unit such as A, mA, μA, or amperes',
  'float', NULL, NULL, FALSE
),
(
  'voltage', 'Voltage', 'measurements',
  'Electric potential difference expressed in volts or related units',
  ARRAY['120 V', '12V', '3.3 volts', '480 VAC'],
  'Numeric value followed by V, kV, mV, or volts; may include AC/DC qualifier',
  'float', NULL, NULL, FALSE
),
(
  'resistance', 'Electrical Resistance', 'measurements',
  'Opposition to electric current expressed in ohms or related units',
  ARRAY['100 Ω', '10 kΩ', '1 MΩ', '470 ohms'],
  'Numeric value followed by Ω, kΩ, MΩ, or ohms',
  'float', NULL, NULL, FALSE
),
(
  'concentration', 'Concentration', 'measurements',
  'Amount of a substance per unit volume or mass expressed with value and unit',
  ARRAY['5 mg/L', '0.1 mol/L', '200 ppm', '10 μg/mL'],
  'Numeric value followed by unit such as mg/L, g/dL, mol/L, ppm, or ppb',
  'float', NULL, NULL, FALSE
),
(
  'force', 'Force', 'measurements',
  'Physical force expressed with a numeric value and unit',
  ARRAY['100 N', '50 lbf', '9.8 kN', '500 dyne'],
  'Numeric value followed by unit such as N, kN, lbf, or dyne',
  'float', NULL, NULL, FALSE
),
(
  'torque', 'Torque', 'measurements',
  'Rotational force expressed with a numeric value and unit',
  ARRAY['250 Nm', '184 ft-lb', '30 kgf·m'],
  'Numeric value followed by unit such as N·m, ft-lb, or kgf·m',
  'float', NULL, NULL, FALSE
),
(
  'fuel_efficiency', 'Fuel Efficiency', 'measurements',
  'Distance traveled per unit of fuel expressed with value and unit',
  ARRAY['30 mpg', '8 L/100km', '12 km/L'],
  'Numeric value followed by unit such as mpg, L/100km, or km/L',
  'float', NULL, NULL, FALSE
);
