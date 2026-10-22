/**
 * Place-card empty copy. Same rule as `src/lib/empty.ts`: never "—".
 * Say what will appear once Nard's feed has the field.
 */
export const PLACE_EMPTY = {
  name: "This place",
  brand: "Local shop",
  address: "Address not on the map yet",
  hours: "Hours not posted yet",
  open: "Hours unknown",
  phone: "No phone listed",
  website: "No site listed",
  description: "No write-up yet",
  photos: "Photos will show when this place has them",
  credit: "Credit coming with the photo",
  hologram: "Model slot",
  photoCaption: "Photo",
  logoCaption: "Logo",
  photoFailed: "Photo didn’t load",
} as const;

export type PlaceEmptyKey = keyof typeof PLACE_EMPTY;
