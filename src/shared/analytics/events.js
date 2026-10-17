// COPIED FROM imotko/src/lib/analytics/events.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).

// Every custom PostHog event name. Call sites import these constants; the guard test keeps the list honest.
export const ANALYTICS_EVENTS = Object.freeze({
    // Wizard-instrumented flows
    AGENCY_REGISTRATION_SUBMITTED: "agency_registration_submitted",
    PRICING_PLAN_SELECTED: "pricing_plan_selected",
    LEAD_SUBMITTED: "lead_submitted",
    PROPERTY_CREATED: "property_created",
    PROPERTY_UPDATED: "property_updated",
    PROPERTY_AI_PREFILL_OPENED: "property_ai_prefill_opened",
    PROPERTY_AI_PREFILL_SUBMITTED: "property_ai_prefill_submitted",
    PROPERTY_AI_PREFILL_APPLIED: "property_ai_prefill_applied",
    PROPERTY_AI_PREFILL_NOTHING_FOUND: "property_ai_prefill_nothing_found",
    PROPERTY_AI_PREFILL_FAILED: "property_ai_prefill_failed",
    PROPERTY_APPROVED: "property_approved",
    FEATURE_INTEREST_REQUESTED: "feature_interest_requested",

    // Migrated from Vercel Web Analytics (names unchanged)
    AGENCY_DASHBOARD_CRM_SEND_OFFER: "agency_dashboard_crm__send_offer",
    AGENCY_DASHBOARD_CRM_DOWNLOAD_OFFER: "agency_dashboard_crm_download_offer",
    AGENCY_DASHBOARD_EXTERNAL_ADS: "agency_dashboard_external_ads",
    AGENCY_DASHBOARD_LEAD_REVEAL_CLICK: "agency_dashboard_lead_reveal_click",
    AGENCY_DASHBOARD_SEND_OFFER: "agency_dashboard_send_offer",
    AGENCY_DASHBOARD_SEND_OFFER_DOWNLOAD_PDF: "agency_dashboard_send_offer_download_pdf",
    AGENCY_DASHBOARD_TIPS_CTA_CLICK: "agency_dashboard_tips_cta_click",
    AGENCY_DASHBOARD_TIPS_GUIDE_VIEW: "agency_dashboard_tips_guide_view",
    AGENCY_DASHBOARD_TIPS_OPEN: "agency_dashboard_tips_open",
    AGENCY_FEEDBACK_MODAL_ALREADY_FILLED: "agency_feedback_modal_already_filled",
    AGENCY_FEEDBACK_MODAL_SURVEY_CLICK: "agency_feedback_modal_survey_click",
    CLICKED_AGENCY_EXAMPLES: "clicked_agency_examples",
    CLICKED_BANK_BANNER_FROM_LOAN_CALCULATOR: "clicked_bank_banner_from_loan_calculator",
    CLICKED_CLOSE_WEBSITEBANNER_AGENCY_DASH: "clicked_close_websitebanner_agency_dash",
    CLICKED_CONNECT_FACEBOOK_AGENCY_DASH: "clicked_connect_facebook_agency_dash",
    CLICKED_GOTO_WEBSITE_AGENCY_DASH: "clicked_goto_website_agency_dash",
    CLICKED_PREVIEW_WEBSITE_AGENCY_DASH: "clicked_preview_website_agency_dash",
    PUBLIC_AGENCY_DETAILS_REVIEW: "public_agency_details_review",
    PUBLIC_PROPERTY_DETAILS_CALL_AGENCY: "public_property_details_call_agency",
    PUBLIC_PROPERTY_DETAILS_FORM_AGENCY: "public_property_details_form_agency",
    PUBLIC_VIDEO: "public_video",

    // Product events added with the PostHog migration
    USER_LOGGED_IN: "user_logged_in",
    USER_SIGNED_UP: "user_signed_up",
    SEARCH_PERFORMED: "search_performed",
    PROPERTY_FAVORITED: "property_favorited",
    PROPERTY_UNFAVORITED: "property_unfavorited",
    SAVED_SEARCH_CREATED: "saved_search_created",
    PROPERTY_SHARED: "property_shared",
    CHAT_CONVERSATION_STARTED: "chat_conversation_started",
    CHAT_MESSAGE_SENT: "chat_message_sent",
    LEAD_UNLOCKED: "lead_unlocked",
    AGENCY_OUTREACH_SENT: "agency_outreach_sent",
    MOBILE_APP_PROMPT_SHOWN: "mobile_app_prompt_shown",
    MOBILE_APP_STORE_CLICKED: "mobile_app_store_clicked",

    // Owner listing funnel (landing -> guest wizard -> gate -> submitted -> published -> first contact)
    OWNER_LANDING_VIEWED: "owner_landing_viewed",
    OWNER_WIZARD_STARTED: "owner_wizard_started",
    OWNER_WIZARD_STEP_COMPLETED: "owner_wizard_step_completed",
    OWNER_GATE_OPENED: "owner_gate_opened",
    OWNER_GATE_CODE_SENT: "owner_gate_code_sent",
    OWNER_GATE_VERIFIED: "owner_gate_verified",
    CLIENT_LISTING_SUBMITTED: "client_listing_submitted",
    CLIENT_LISTING_PUBLISHED: "client_listing_published",
    CLIENT_LISTING_FIRST_CONTACT: "client_listing_first_contact",
})
