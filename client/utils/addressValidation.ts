import { calculateDistance } from "./distance";

export interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

export const checkDuplicateAddress = (
  newAddress: { latitude: number; longitude: number; street: string },
  existingAddresses: Address[],
): Address | null => {
  // Check for coordinate duplicates (within 100m)
  const coordinateDuplicate = existingAddresses.find(
    (addr) =>
      calculateDistance(
        addr.latitude,
        addr.longitude,
        newAddress.latitude,
        newAddress.longitude,
      ) < 0.1, // 100 meters
  );

  if (coordinateDuplicate) return coordinateDuplicate;

  // Check for similar street addresses
  const streetDuplicate = existingAddresses.find((addr) => {
    const normalizeStreet = (str: string) =>
      str
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^\w\s]/g, "")
        .trim();

    return normalizeStreet(addr.street) === normalizeStreet(newAddress.street);
  });

  return streetDuplicate || null;
};

export const suggestSimilarAddresses = (
  searchText: string,
  existingAddresses: Address[],
): Address[] => {
  if (!searchText || searchText.length < 3) return [];

  const normalizedSearch = searchText.toLowerCase();

  return existingAddresses
    .filter(
      (addr) =>
        addr.street.toLowerCase().includes(normalizedSearch) ||
        addr.label.toLowerCase().includes(normalizedSearch),
    )
    .slice(0, 3); // Limit to 3 suggestions
};
