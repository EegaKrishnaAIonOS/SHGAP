from dataclasses import dataclass


@dataclass(frozen=True)
class SchemeChunkSeed:
    scheme_name: str
    source_title: str
    source_url: str
    content: str


# Real, officially-sourced content on Andhra Pradesh/MEPMA-relevant SHG credit
# schemes (T12), gathered via web research rather than fabricated — this is
# for a real government platform. Deliberately small and non-exhaustive: it
# covers the schemes an SHG member is most likely to ask about, each grounded
# in a real, citable source, rather than attempting a comprehensive scheme
# database. See ADR-0021 for the sourcing rationale and its limitations.
SCHEME_CHUNKS: list[SchemeChunkSeed] = [
    SchemeChunkSeed(
        scheme_name=(
            "DAY-NULM Self Employment Programme (SEP) & Urban Women Self-help Programme (UWSP)"
        ),
        source_title="APMEPMA — Self Help Groups",
        source_url="https://apmepma.gov.in/shg/",
        content=(
            "The Self Employment Programme (SEP) under DAY-NULM provides individual loans of "
            "Rs 50,000 to Rs 2,00,000 to women SHG members through banks, with MEPMA sanctioning "
            "a matching interest subvention of 7% per annum on top of what the bank charges."
        ),
    ),
    SchemeChunkSeed(
        scheme_name=(
            "DAY-NULM Self Employment Programme (SEP) & Urban Women Self-help Programme (UWSP)"
        ),
        source_title="APMEPMA — Self Help Groups",
        source_url="https://apmepma.gov.in/shg/",
        content=(
            "Under the Urban Women Self-help Programme (UWSP), SHGs can access group loans of up "
            "to Rs 5,00,000. Across both SEP and UWSP, the interest subsidy is the gap between the "
            "bank's rate and 7% per annum on all loans to urban poor SHGs, with an additional 3% "
            "subvention for Women SHGs (WSHGs) that repay their loan on time."
        ),
    ),
    SchemeChunkSeed(
        scheme_name="Vaddi Leni Runaalu (Interest-Free Loans)",
        source_title="APMEPMA",
        source_url="https://apmepma.gov.in/",
        content=(
            "Vaddi Leni Runaalu is a flagship Andhra Pradesh government scheme, implemented by "
            "MEPMA in urban areas and SERP in rural areas, under which the state government bears "
            "the entire interest burden on bank loans taken by women SHGs — the SHG effectively "
            "repays the bank only the principal amount."
        ),
    ),
    SchemeChunkSeed(
        scheme_name="Vaddi Leni Runaalu (Interest-Free Loans)",
        source_title=(
            "State govt raises interest-free loan limit for SHGs to Rs 10L — The Hans India"
        ),
        source_url=(
            "https://www.thehansindia.com/telangana/"
            "state-govt-raises-interest-free-loan-limit-for-shgs-to-rs-10l-1073333"
        ),
        content=(
            "The interest-free loan limit for SHGs under Vaddi Leni Runaalu was raised from Rs 5 "
            "lakh to Rs 10 lakh in May 2026, a move expected to benefit around 63 lakh SHG women "
            "across the state by increasing their credit-availing capacity."
        ),
    ),
    SchemeChunkSeed(
        scheme_name="PM SVANidhi",
        source_title="PM SVANidhi — Ministry of Housing & Urban Affairs",
        source_url="https://pmsvanidhi.mohua.gov.in/",
        content=(
            "PM SVANidhi (PM Street Vendor's AtmaNirbhar Nidhi), a Central Sector Scheme of the "
            "Ministry of Housing & Urban Affairs launched on 1 June 2020, provides collateral-free "
            "working-capital loans to street vendors — including SHG-linked vendors — in tranches: "
            "an original first tranche of Rs 10,000, a second of Rs 20,000 on timely repayment of "
            "the first, and a third of Rs 50,000 on timely repayment of the second."
        ),
    ),
    SchemeChunkSeed(
        scheme_name="PM SVANidhi",
        source_title="PM SVANidhi — Ministry of Housing & Urban Affairs",
        source_url="https://pmsvanidhi.mohua.gov.in/",
        content=(
            "Under the restructured PM SVANidhi 2.0, tranche amounts were revised upward to "
            "Rs 15,000 / Rs 25,000 / Rs 50,000, with registration and loan support continuing "
            "until 31 March 2030. All tranches carry a 7% per annum interest subsidy credited "
            "quarterly, plus a cashback of up to Rs 100 per month for vendors who make digital "
            "payment transactions."
        ),
    ),
    SchemeChunkSeed(
        scheme_name="SthreeNidhi",
        source_title="SthreeNidhi Credit Cooperative Federation — Government of Andhra Pradesh",
        source_url="https://www.sthreenidhi.ap.gov.in/",
        content=(
            "SthreeNidhi Credit Cooperative Federation Ltd. is an Andhra Pradesh government-"
            "promoted cooperative (registered 2011) that supplements bank credit to SHGs, aiming "
            "to sanction and disburse loans to SHG women within 48 hours using an IVRS/mobile-"
            "based process, even in remote areas."
        ),
    ),
    SchemeChunkSeed(
        scheme_name="SthreeNidhi",
        source_title="SthreeNidhi Credit Cooperative Federation — Government of Andhra Pradesh",
        source_url="https://www.sthreenidhi.ap.gov.in/",
        content=(
            "SthreeNidhi loans are meant for livelihood activities and require SHG members to "
            "maintain a Samrudhi savings deposit of Rs 100 per month as part of the federation's "
            "credit-discipline model."
        ),
    ),
    SchemeChunkSeed(
        scheme_name="PM Mudra Yojana (PMMY)",
        source_title="Pradhan Mantri Mudra Yojana — Offerings",
        source_url="https://www.mudra.org.in/offerings",
        content=(
            "Pradhan Mantri Mudra Yojana (PMMY) offers collateral-free micro-loans in four tiers: "
            "Shishu (up to Rs 50,000), Kishore (Rs 50,000 to Rs 5,00,000), Tarun (Rs 5,00,000 to "
            "Rs 10,00,000), and Tarun Plus (Rs 10,00,000 to Rs 20,00,000, for borrowers who have "
            "successfully repaid a Tarun loan) — the Rs 20 lakh ceiling was doubled from Rs 10 "
            "lakh in the 2024-25 Union Budget."
        ),
    ),
    SchemeChunkSeed(
        scheme_name="PM Mudra Yojana (PMMY)",
        source_title="Loan limit under PMMY increased to Rs 20 lakh — PIB",
        source_url="https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2068019",
        content=(
            "PMMY loans up to Rs 20 lakh are backed by guarantee coverage under the Credit "
            "Guarantee Fund for Micro Units (CGFMU), which reduces the collateral burden on "
            "lending banks and makes it easier for SHG members and small entrepreneurs without "
            "collateral to access credit."
        ),
    ),
    SchemeChunkSeed(
        scheme_name="MEPMA 2025-26 Action Plan",
        source_title=(
            "MEPMA Comes Up With Action Plan to Empower Women Financially — Deccan Chronicle"
        ),
        source_url=(
            "https://www.deccanchronicle.com/southern-states/andhra-pradesh/"
            "mepma-comes-up-with-action-plan-to-empower-women-financially-1871143"
        ),
        content=(
            "MEPMA's 2025-26 action plan targets bank linkage worth Rs 8,000 crore for at least "
            "80,000 SHGs in urban Andhra Pradesh, alongside grooming 30,000 women as "
            "entrepreneurs — 10,000 existing business owners given advanced training and 20,000 "
            "new entrepreneurs developed."
        ),
    ),
    SchemeChunkSeed(
        scheme_name="MEPMA 2025-26 Action Plan",
        source_title=(
            "MEPMA Comes Up With Action Plan to Empower Women Financially — Deccan Chronicle"
        ),
        source_url=(
            "https://www.deccanchronicle.com/southern-states/andhra-pradesh/"
            "mepma-comes-up-with-action-plan-to-empower-women-financially-1871143"
        ),
        content=(
            "Under the Self-Employment Scheme component of this plan, Rs 5 crore is earmarked for "
            "100 individuals through SHG groups, with a further Rs 80 crore to be disbursed to "
            "8,000 individuals."
        ),
    ),
]
