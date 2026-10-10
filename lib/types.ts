export type Mode = "newcomer" | "reskill";
export type Lang = "en" | "es";

export type OpportunityType =
  | "community" | "meetup" | "mentorship" | "career-service" | "training"
  | "certificate" | "apprenticeship" | "program" | "event";

export type Schedule = "evenings" | "weekends" | "online" | "full-time";

export interface Opportunity {
  id: string;
  name: string;
  type: OpportunityType;
  description: string;
  url: string;
  neighborhood?: string;
  cost: "free" | "low" | "paid" | "varies";
  cost_note?: string;
  duration?: string;
  schedule?: Schedule[];
  languages: string[];
  audience_tags: string[];
  sector_tags: string[];
  skills_taught?: string[];
  no_degree_friendly: boolean;
  modes: Mode[];
  source_url: string;
  last_verified: string;
  needs_verification?: boolean;
}

export interface Occupation {
  onet_code: string;
  title: string;
  title_es: string;
  aliases: string[];
  sector: string;
  typical_education: "none" | "high_school" | "postsecondary_cert" | "associate" | "bachelor";
  key_skills: string[];
  related_codes: string[];
  median_wage_miami?: number;
  hourly_wage_miami?: number;
}

export interface Profile {
  current_role: string;
  years_experience: number | null;
  current_pay_annual?: number | null;
  skills: string[];
  skill_tags: string[];
  sectors: string[];
  target_sectors: string[];
  education_level: string;
  has_us_degree: boolean;
  languages: string[];
  goals: string[];
  target_role?: string | null;
  constraints: {
    budget: "free" | "low" | "any" | string;
    hours_per_week: number | null;
    schedule: string[];
    transport: string | null;
    family: string | null;
  };
  neighborhood?: string | null;
  preferred_language: Lang;
  lives_in_miami: boolean;
  // Suggested by the model from our O*NET list, then checked against the data:
  current_onet_code?: string | null;
  target_onet_code?: string | null;
}

export interface ScoredOpportunity {
  opportunity: Opportunity;
  score: number;
  reasons: string[];
  covers_gaps?: string[];
}

export interface TargetOption {
  onet_code: string;
  title: string;
  title_es: string;
  median_wage_miami?: number;
  skill_overlap: number;
  transferable_skills: string[];
  skills_to_build: string[];
  why_it_fits?: string;
}

export interface LadderStepSkeleton {
  step: number;
  onet_code: string;
  title: string;
  title_es: string;
  median_wage_miami?: number;
  typical_education: Occupation["typical_education"];
  transferable_skills: string[];
  skills_to_build: string[];
  training_candidate_ids: string[];
}

export interface Candidates {
  mode: Mode;
  items: ScoredOpportunity[];
  // Reskill mode only:
  current?: Occupation | null;
  target?: Occupation | null;
  target_options?: TargetOption[];
  ladder?: LadderStepSkeleton[];
}

export interface PlanItem { opportunity_id: string; why_it_fits: string; next_step: string }

export interface NewcomerPlan {
  summary: string;
  weeks: { week: number; focus: string; items: PlanItem[] }[];
  career_paths: { title: string; onet_code: string; why: string }[];
  first_message_template: string;
}

export interface ReskillPlan {
  summary: string;
  target_options: { title: string; onet_code: string; why_it_fits: string; median_wage_miami?: number }[];
  ladder: {
    step: number;
    role: string;
    onet_code: string;
    median_wage_miami?: number;
    transferable_skills: string[];
    skills_to_build: string[];
    options: { opportunity_id: string; why: string; cost?: string; duration?: string; schedule?: string[] }[];
    est_time_to_reach: string;
    next_action_this_week: string;
  }[];
  network_items: { opportunity_id: string; why: string }[];
  first_message_template: string;
}
