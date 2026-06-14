// Rich-field schema per Banquet & Event Services category.
//
// Each category maps to a list of "groups", each group has fields that
// render into the operator's "Add Service" modal. Field types:
//   - text:    single-line Input
//   - textarea: multi-line Textarea
//   - number:  numeric Input
//   - select:  Select dropdown (uses `options`)
//   - multi:   chip-style multi-select (uses `options`)
//   - bool:    Checkbox
//
// The form component (`CategoryDetailsFields.jsx`) walks this object and
// renders the right control for each field. The backend stores all
// answers in a single `category_details: Dict[str, Any]` field on the
// banquet doc, so adding a new field per category never needs a backend
// migration.
//
// Keep field keys snake_case so backend dashboards can grep for them.

export const CATEGORY_SCHEMA = {
  // ── Hall / Venue ───────────────────────────────────────────────────
  hall: [
    {
      label: 'Venue setup',
      fields: [
        { key: 'parking_capacity', type: 'number', label: 'Parking spaces' },
        { key: 'outdoor_area', type: 'bool', label: 'Has outdoor area' },
        { key: 'has_kitchen', type: 'bool', label: 'Equipped kitchen' },
        { key: 'has_bar', type: 'bool', label: 'Bar / counter' },
        { key: 'noise_curfew', type: 'text', label: 'Noise curfew time (e.g. 23:00)' },
      ],
    },
    {
      label: 'Layouts available',
      fields: [
        { key: 'setup_styles', type: 'multi', label: 'Layouts', options: ['banquet', 'theater', 'cocktail', 'u-shape', 'classroom', 'boardroom'] },
        { key: 'accessibility', type: 'multi', label: 'Accessibility', options: ['wheelchair ramp', 'elevator', 'accessible toilets', 'baby changing'] },
      ],
    },
  ],

  // ── Rental items (chairs, plates, spoons, cutlery, …) ──────────────
  rental_item: [
    {
      label: 'Item details',
      fields: [
        { key: 'material', type: 'text', label: 'Material (e.g. plastic, glass, gold-finish steel)' },
        { key: 'colors', type: 'multi', label: 'Available colors', options: ['white', 'black', 'gold', 'silver', 'red', 'blue', 'green', 'rose', 'brown'] },
        { key: 'condition', type: 'select', label: 'Condition', options: ['new', 'like new', 'used'] },
        { key: 'replacement_cost', type: 'number', label: 'Replacement cost per unit (FCFA)' },
      ],
    },
    {
      label: 'Service inclusions',
      fields: [
        { key: 'delivery_included', type: 'bool', label: 'Delivery included' },
        { key: 'pickup_included', type: 'bool', label: 'Pickup after event included' },
        { key: 'cleaning_included', type: 'bool', label: 'Cleaning included' },
        { key: 'damage_policy', type: 'textarea', label: 'Damage / loss policy' },
      ],
    },
  ],

  // ── Canopy / Tent ──────────────────────────────────────────────────
  canopy: [
    {
      label: 'Canopy specs',
      fields: [
        { key: 'size_m', type: 'text', label: 'Size (e.g. 10×20 m)' },
        { key: 'material', type: 'text', label: 'Material (e.g. waterproof PVC)' },
        { key: 'wind_resistant', type: 'bool', label: 'Wind resistant' },
        { key: 'rain_proof', type: 'bool', label: 'Rain proof' },
        { key: 'includes_lighting', type: 'bool', label: 'Lighting included' },
        { key: 'includes_flooring', type: 'bool', label: 'Flooring included' },
      ],
    },
    {
      label: 'Setup',
      fields: [
        { key: 'setup_time_hours', type: 'number', label: 'Setup time (hours)' },
        { key: 'crew_size', type: 'number', label: 'Crew size included' },
      ],
    },
  ],

  // ── Photographer ──────────────────────────────────────────────────
  photographer: [
    {
      label: 'About',
      fields: [
        { key: 'years_experience', type: 'number', label: 'Years of experience' },
        { key: 'team_size', type: 'number', label: 'Team size (photographers on shoot)' },
        { key: 'languages', type: 'multi', label: 'Languages', options: ['English', 'French', 'Pidgin', 'Other'] },
        { key: 'portfolio_url', type: 'text', label: 'Portfolio URL' },
        { key: 'instagram_handle', type: 'text', label: 'Instagram @handle' },
      ],
    },
    {
      label: 'Style & gear',
      fields: [
        { key: 'style', type: 'multi', label: 'Style', options: ['documentary', 'cinematic', 'traditional', 'candid', 'editorial', 'fashion'] },
        { key: 'equipment', type: 'multi', label: 'Equipment', options: ['DSLR', 'mirrorless', 'medium-format', 'prime lenses', 'zoom lenses', 'lighting kit', 'gimbal'] },
        { key: 'drone_licensed', type: 'bool', label: 'Drone licensed' },
        { key: 'travels_outside_city', type: 'bool', label: 'Travels outside the city' },
      ],
    },
    {
      label: 'Deliverables',
      fields: [
        { key: 'deliverables', type: 'multi', label: 'Deliverables', options: ['digital album', 'printed book', 'USB', 'cloud gallery', 'highlight reel'] },
        { key: 'edited_photos_count', type: 'number', label: 'Edited photos included' },
        { key: 'revisions_included', type: 'number', label: 'Revisions included' },
        { key: 'turnaround_days', type: 'number', label: 'Turnaround time (days)' },
      ],
    },
  ],

  // ── Videographer ──────────────────────────────────────────────────
  videographer: [
    {
      label: 'About',
      fields: [
        { key: 'years_experience', type: 'number', label: 'Years of experience' },
        { key: 'team_size', type: 'number', label: 'Crew size on shoot' },
        { key: 'portfolio_url', type: 'text', label: 'Showreel URL' },
        { key: 'instagram_handle', type: 'text', label: 'Instagram @handle' },
      ],
    },
    {
      label: 'Style & gear',
      fields: [
        { key: 'style', type: 'multi', label: 'Style', options: ['cinematic', 'highlight reel', 'documentary', 'social-first vertical', 'drone'] },
        { key: 'equipment', type: 'multi', label: 'Equipment', options: ['4K camera', '8K camera', 'gimbal', 'drone', 'wireless mics', 'lighting kit'] },
        { key: 'drone_licensed', type: 'bool', label: 'Drone licensed' },
      ],
    },
    {
      label: 'Deliverables',
      fields: [
        { key: 'deliverables', type: 'multi', label: 'Deliverables', options: ['highlight reel', 'full ceremony cut', 'social cuts', 'raw footage', 'cloud delivery'] },
        { key: 'final_video_length_min', type: 'number', label: 'Final video length (minutes)' },
        { key: 'revisions_included', type: 'number', label: 'Revisions included' },
        { key: 'turnaround_days', type: 'number', label: 'Turnaround time (days)' },
      ],
    },
  ],

  // ── Catering ──────────────────────────────────────────────────────
  catering: [
    {
      label: 'Cuisine',
      fields: [
        { key: 'cuisines', type: 'multi', label: 'Cuisines', options: ['Cameroonian', 'Continental', 'Asian', 'French', 'Italian', 'Lebanese', 'Pastry/Desserts'] },
        { key: 'dietary_options', type: 'multi', label: 'Dietary options', options: ['vegan', 'vegetarian', 'halal', 'kosher', 'gluten-free', 'nut-free', 'kid-friendly'] },
        { key: 'signature_dishes', type: 'textarea', label: 'Signature dishes' },
      ],
    },
    {
      label: 'Service',
      fields: [
        { key: 'service_style', type: 'multi', label: 'Service style', options: ['buffet', 'plated', 'cocktail', 'family-style', 'food stations'] },
        { key: 'min_guests', type: 'number', label: 'Minimum guests' },
        { key: 'max_guests', type: 'number', label: 'Maximum guests' },
        { key: 'staff_included', type: 'number', label: 'Service staff included' },
        { key: 'equipment_provided', type: 'bool', label: 'Equipment (plates, cutlery, glasses) included' },
        { key: 'bar_service', type: 'bool', label: 'Bar service available' },
      ],
    },
  ],

  // ── Decoration ────────────────────────────────────────────────────
  decoration: [
    {
      label: 'Style',
      fields: [
        { key: 'styles', type: 'multi', label: 'Styles offered', options: ['modern', 'traditional', 'rustic', 'luxury', 'minimalist', 'boho', 'tropical'] },
        { key: 'palette', type: 'text', label: 'Default palette / colors' },
        { key: 'floral_included', type: 'bool', label: 'Floral arrangements included' },
      ],
    },
    {
      label: 'Inclusions',
      fields: [
        { key: 'setup_time_hours', type: 'number', label: 'Setup time (hours)' },
        { key: 'takedown_included', type: 'bool', label: 'Takedown after event included' },
        { key: 'lighting_included', type: 'bool', label: 'Lighting / ambient included' },
        { key: 'backdrop_included', type: 'bool', label: 'Photo backdrop included' },
        { key: 'centerpieces_per_table', type: 'number', label: 'Centerpieces per table' },
      ],
    },
  ],

  // ── Sound & Lighting ──────────────────────────────────────────────
  sound_lighting: [
    {
      label: 'Sound',
      fields: [
        { key: 'pa_watts', type: 'number', label: 'PA system power (watts)' },
        { key: 'speakers_count', type: 'number', label: 'Speakers' },
        { key: 'microphones_count', type: 'number', label: 'Microphones' },
        { key: 'engineer_included', type: 'bool', label: 'Sound engineer included' },
        { key: 'dj_included', type: 'bool', label: 'DJ included' },
      ],
    },
    {
      label: 'Lighting',
      fields: [
        { key: 'lighting_rigs', type: 'number', label: 'Lighting rigs / fixtures' },
        { key: 'coverage_m2', type: 'number', label: 'Coverage area (m²)' },
        { key: 'effects', type: 'multi', label: 'Effects', options: ['par lights', 'moving heads', 'smoke', 'strobe', 'lasers', 'uplighting'] },
      ],
    },
  ],

  // ── Other ─────────────────────────────────────────────────────────
  other: [
    {
      label: 'Details',
      fields: [
        { key: 'notes', type: 'textarea', label: 'Describe the service' },
        { key: 'inclusions', type: 'textarea', label: 'What\'s included' },
      ],
    },
  ],
};

// Helper: returns an array of all field keys for a category (used for
// validation + serialization).
export function fieldsForCategory(category) {
  return (CATEGORY_SCHEMA[category] || []).flatMap(group => group.fields);
}
