const PROPERTY_IMAGES = [
  "/brand/property-game-lodge.jpg",
  "/brand/property-winelands.jpg",
  "/brand/property-robertson.jpg",
] as const;

export function getPropertyImage(
  name: string,
  id?: number,
  address?: string
): string {
  const n = `${name} ${address || ""}`.toLowerCase();
  if (
    n.includes("melozhori") ||
    n.includes("game") ||
    n.includes("lodge") ||
    n.includes("safari") ||
    n.includes("kruger")
  ) {
    return "/brand/property-game-lodge.jpg";
  }
  if (n.includes("robertson")) {
    return "/brand/property-robertson.jpg";
  }
  if (
    n.includes("wineland") ||
    n.includes("stellenbosch") ||
    n.includes("franschhoek") ||
    n.includes("franschoek") ||
    n.includes("franschooek") ||
    n.includes("vineyard") ||
    n.includes("paris")
  ) {
    return "/brand/property-winelands.jpg";
  }
  const index = ((id ?? name.length) - 1) % PROPERTY_IMAGES.length;
  return PROPERTY_IMAGES[index < 0 ? 0 : index];
}

export function getPropertyKind(name: string, address?: string): string {
  const n = `${name} ${address || ""}`.toLowerCase();
  if (n.includes("game") || n.includes("lodge") || n.includes("safari")) {
    return "Game Lodge";
  }
  if (n.includes("robertson")) {
    return "Robertson Valley";
  }
  if (
    n.includes("wineland") ||
    n.includes("stellenbosch") ||
    n.includes("franschhoek") ||
    n.includes("franschoek") ||
    n.includes("franschooek") ||
    n.includes("paris")
  ) {
    return "Cape Winelands";
  }
  return "Grand Holdings Property";
}
