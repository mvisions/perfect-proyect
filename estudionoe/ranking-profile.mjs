const text = (value, max) => typeof value === "string" && value.trim().length > 0
  && value.trim().length <= max && !/[\u0000-\u001f\u007f<>]/.test(value);

export function isPetProfile(profile) {
  return Boolean(profile && text(profile.petName, 40) && text(profile.animalType, 30));
}

export function isRankingProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return false;
  if ("petName" in profile || "animalType" in profile) return isPetProfile(profile);
  return text(profile.name, 40) && text(profile.course, 30);
}

export function rankingProfileFields(profile) {
  if (!isRankingProfile(profile)) throw new Error("El perfil del ranking no es válido.");
  return isPetProfile(profile)
    ? { petName: profile.petName.trim(), animalType: profile.animalType.trim() }
    : { name: profile.name.trim(), course: profile.course.trim() };
}

export function rankingIdentity(profile) {
  const fields = rankingProfileFields(profile);
  return isPetProfile(fields)
    ? { name: fields.petName, detail: fields.animalType, legacy: false }
    : { name: fields.name, detail: `Resultado antiguo · Curso: ${fields.course}`, legacy: true };
}
