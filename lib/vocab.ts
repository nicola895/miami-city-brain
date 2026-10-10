// Controlled vocabulary shared by data/opportunities.json, data/onet_subset.csv and the prompts.
export const SKILLS = [
  "customer_service", "communication", "scheduling", "team_leadership", "conflict_resolution", "problem_solving",
  "computer_basics", "it_support", "networking", "cybersecurity", "cloud", "programming", "web_development",
  "data_analysis", "spreadsheets", "sql", "python", "project_management", "sales", "marketing", "social_media",
  "bookkeeping", "accounting", "medical_terminology", "patient_care", "medical_billing_coding", "ehr_systems",
  "phlebotomy", "pharmacy", "logistics", "inventory", "supply_chain", "forklift", "cdl_driving", "electrical",
  "hvac", "plumbing", "carpentry", "welding", "construction_safety", "real_estate_law", "negotiation",
  "property_management", "hospitality_operations", "food_safety", "revenue_management", "english_language",
  "entrepreneurship", "finance", "ux_design", "ai_ml", "community_health", "quality_assurance", "crm_tools",
  "cash_handling", "writing",
] as const;

export const SECTORS = [
  "tech", "fintech", "health", "logistics", "trades", "real_estate", "hospitality", "creative", "startups",
  "finance", "government", "education", "nonprofit", "general",
] as const;

export const GOALS = [
  "meet_people", "find_job", "change_career", "start_business", "learn_english", "get_certified",
  "find_mentor", "higher_pay", "stable_hours", "transfer_license",
] as const;

const SKILL_SET = new Set<string>(SKILLS);
const SECTOR_SET = new Set<string>(SECTORS);
export const isSkill = (s: string) => SKILL_SET.has(s);
export const isSector = (s: string) => SECTOR_SET.has(s);

/** Human label for a skill tag, e.g. "it_support" -> "IT support". */
export function skillLabel(tag: string, lang: "en" | "es" = "en"): string {
  const es: Record<string, string> = {
    customer_service: "Atención al cliente", communication: "Comunicación", scheduling: "Programación de horarios",
    team_leadership: "Liderazgo de equipo", conflict_resolution: "Resolución de conflictos",
    problem_solving: "Resolución de problemas", computer_basics: "Informática básica", it_support: "Soporte técnico",
    networking: "Redes informáticas", cybersecurity: "Ciberseguridad", cloud: "Nube", programming: "Programación",
    web_development: "Desarrollo web", data_analysis: "Análisis de datos", spreadsheets: "Hojas de cálculo",
    project_management: "Gestión de proyectos", sales: "Ventas", marketing: "Marketing", social_media: "Redes sociales",
    bookkeeping: "Teneduría de libros", accounting: "Contabilidad", medical_terminology: "Terminología médica",
    patient_care: "Atención al paciente", medical_billing_coding: "Facturación y codificación médica",
    ehr_systems: "Historias clínicas electrónicas", phlebotomy: "Flebotomía", pharmacy: "Farmacia",
    logistics: "Logística", inventory: "Inventario", supply_chain: "Cadena de suministro", forklift: "Montacargas",
    cdl_driving: "Licencia CDL", electrical: "Electricidad", hvac: "Aire acondicionado (HVAC)", plumbing: "Plomería",
    carpentry: "Carpintería", welding: "Soldadura", construction_safety: "Seguridad en obra",
    real_estate_law: "Ley inmobiliaria", negotiation: "Negociación", property_management: "Administración de propiedades",
    hospitality_operations: "Operaciones hoteleras", food_safety: "Seguridad alimentaria",
    revenue_management: "Gestión de ingresos", english_language: "Inglés", entrepreneurship: "Emprendimiento",
    finance: "Finanzas", ux_design: "Diseño UX", ai_ml: "IA / aprendizaje automático", community_health: "Salud comunitaria",
    quality_assurance: "Control de calidad", crm_tools: "Herramientas CRM", cash_handling: "Manejo de caja", writing: "Redacción",
  };
  if (lang === "es" && es[tag]) return es[tag];
  const special: Record<string, string> = {
    it_support: "IT support", sql: "SQL", python: "Python", ux_design: "UX design", ai_ml: "AI / ML",
    hvac: "HVAC", cdl_driving: "CDL driving", ehr_systems: "EHR systems", crm_tools: "CRM tools",
    english_language: "English",
  };
  if (special[tag]) return special[tag];
  const s = tag.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
