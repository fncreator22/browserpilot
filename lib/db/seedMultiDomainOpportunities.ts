import { prisma } from "./prisma";

export async function seedMultiDomainOpportunities(): Promise<void> {
  const opps = [
    {
      canonicalHash: "mech_tata_delhi_01",
      title: "Mechanical Design Engineer - Automotive Systems",
      companyName: "Tata Motors",
      location: "Delhi NCR, India",
      workMode: "ON_SITE",
      experienceLevel: "ENTRY_LEVEL",
      opportunityType: "FULL_TIME",
      salaryMin: 700000,
      salaryMax: 1100000,
      salaryCurrency: "INR",
      description: "Mechanical engineering role responsible for CAD modeling, chassis design, thermal analysis, and powertrain integration for next-generation electric vehicles. Work directly with cross-functional manufacturing and CAE teams in Delhi NCR.",
      requirements: JSON.stringify([
        "BE / B.Tech in Mechanical Engineering or Automotive Engineering",
        "Proficiency in SolidWorks, CATIA V5, or Siemens NX",
        "Solid understanding of GD&T, sheet metal fabrication, and casting tolerances",
        "Knowledge of thermal management and FEA stress analysis"
      ]),
      skills: JSON.stringify(["Mechanical Engineering", "SolidWorks", "CAD", "CATIA", "Thermal Analysis", "Automotive Design", "GD&T"]),
      primaryApplyUrl: "https://careers.tatamotors.com/jobs/delhi-mechanical-design-engineer",
      status: "ACTIVE",
      sourcePlatform: "Tata Motors Career Portal",
      contact: {
        fullName: "Vikram Malhotra",
        roleTitle: "Lead Talent Partner - Engineering & R&D",
        department: "Talent Acquisition",
        profileUrl: "https://linkedin.com/in/vikram-malhotra-tatamotors",
        email: "v.malhotra@tatamotors.com",
        isVerified: true,
      }
    },
    {
      canonicalHash: "mech_lt_delhi_02",
      title: "Mechanical Engineer - HVAC & Piping Systems",
      companyName: "Larsen & Toubro (L&T)",
      location: "Delhi NCR, India",
      workMode: "HYBRID",
      experienceLevel: "MID",
      opportunityType: "FULL_TIME",
      salaryMin: 900000,
      salaryMax: 1400000,
      salaryCurrency: "INR",
      description: "Lead mechanical systems design for major metro rail and infrastructure facilities in Delhi NCR. Accountable for HVAC heat load calculations, duct routing, chiller plant schematics, and mechanical piping stress simulations.",
      requirements: JSON.stringify([
        "B.Tech in Mechanical Engineering with 2-5 years experience",
        "Hands-on expertise in HAP / Trace 700 heat load calculation",
        "Proficiency in AutoCAD MEP and Revit",
        "Familiarity with ASHRAE standards and NBC building codes"
      ]),
      skills: JSON.stringify(["Mechanical Engineering", "HVAC", "AutoCAD", "Piping", "Thermal Systems", "Revit", "MEP"]),
      primaryApplyUrl: "https://www.larsentoubro.com/corporate/careers/delhi-hvac-mechanical-engineer",
      status: "ACTIVE",
      sourcePlatform: "L&T Careers",
      contact: {
        fullName: "Ananya Sharma",
        roleTitle: "Senior Technical Recruiter",
        department: "Heavy Civil Infrastructure",
        profileUrl: "https://linkedin.com/in/ananya-sharma-recruiter",
        email: "ananya.sharma@larsentoubro.com",
        isVerified: true,
      }
    },
    {
      canonicalHash: "mech_honeywell_delhi_03",
      title: "Mechanical Systems & Automation Engineer",
      companyName: "Honeywell",
      location: "Gurgaon, Delhi NCR, India",
      workMode: "HYBRID",
      experienceLevel: "ENTRY_LEVEL",
      opportunityType: "FULL_TIME",
      salaryMin: 850000,
      salaryMax: 1300000,
      salaryCurrency: "INR",
      description: "Mechanical engineering role developing electromechanical enclosures, robotic mechanisms, thermal dissipation units, and automated building management systems. Collaborate with firmware and industrial design teams.",
      requirements: JSON.stringify([
        "B.Tech in Mechanical, Production, or Mechatronics Engineering",
        "Hands-on CAD modeling in Creo or SolidWorks",
        "Understanding of plastic injection molding and die casting design principles",
        "Experience in vibration and thermal testing"
      ]),
      skills: JSON.stringify(["Mechanical Engineering", "Mechatronics", "CAD", "SolidWorks", "Creo", "Automation", "Thermal Design"]),
      primaryApplyUrl: "https://honeywell.csod.com/ux/ats/careersite/1/home/requisition/gurgaon-mech-engineer",
      status: "ACTIVE",
      sourcePlatform: "Greenhouse",
      contact: {
        fullName: "Rohan Kapoor",
        roleTitle: "University & Early Career Recruiting Specialist",
        department: "Honeywell Technology Solutions",
        profileUrl: "https://linkedin.com/in/rohan-kapoor-honeywell",
        email: "rohan.kapoor@honeywell.com",
        isVerified: true,
      }
    },
    {
      canonicalHash: "mech_maruti_delhi_04",
      title: "Mechanical Reliability & Maintenance Engineer",
      companyName: "Maruti Suzuki",
      location: "Delhi NCR, India",
      workMode: "ON_SITE",
      experienceLevel: "ENTRY_LEVEL",
      opportunityType: "FULL_TIME",
      salaryMin: 650000,
      salaryMax: 1050000,
      salaryCurrency: "INR",
      description: "Manage plant-wide mechanical integrity, robotic spot welding lines, hydraulic press maintenance, and pneumatic distribution systems. Drive Kaizen and root-cause analysis to ensure maximum manufacturing uptime.",
      requirements: JSON.stringify([
        "Degree in Mechanical Engineering",
        "Strong understanding of pneumatic and hydraulic systems",
        "Familiarity with Total Productive Maintenance (TPM) and 5S",
        "Excellent troubleshooting skills for automated production machinery"
      ]),
      skills: JSON.stringify(["Mechanical Engineering", "Plant Maintenance", "Hydraulics", "Pneumatics", "Reliability", "Manufacturing"]),
      primaryApplyUrl: "https://www.marutisuzuki.com/corporate/careers/delhi-plant-maintenance-engineer",
      status: "ACTIVE",
      sourcePlatform: "Maruti Suzuki Careers",
      contact: {
        fullName: "Pooja Verma",
        roleTitle: "HR Lead - Manufacturing Operations",
        department: "Human Resources",
        profileUrl: "https://linkedin.com/in/pooja-verma-maruti",
        email: "pooja.verma@maruti.co.in",
        isVerified: true,
      }
    },
    {
      canonicalHash: "civil_aecom_delhi_05",
      title: "Civil Infrastructure & Structural Engineer",
      companyName: "AECOM",
      location: "Delhi NCR, India",
      workMode: "HYBRID",
      experienceLevel: "ENTRY_LEVEL",
      opportunityType: "FULL_TIME",
      salaryMin: 650000,
      salaryMax: 950000,
      salaryCurrency: "INR",
      description: "Structural modeling and design for elevated metro corridors, urban highways, and multi-span bridges in Delhi NCR. Perform finite element structural analysis and produce engineering fabrication drawings.",
      requirements: JSON.stringify([
        "B.Tech in Civil Engineering",
        "Knowledge of STAAD.Pro, ETABS, or SAP2000",
        "Proficiency in AutoCAD structural detailing",
        "Working knowledge of Indian Standard (IS) codes for RCC and steel design"
      ]),
      skills: JSON.stringify(["Civil Engineering", "STAAD.Pro", "Structural Analysis", "AutoCAD", "Concrete Design"]),
      primaryApplyUrl: "https://aecom.com/careers/delhi-civil-infrastructure-engineer",
      status: "ACTIVE",
      sourcePlatform: "AECOM Career Portal",
      contact: {
        fullName: "Siddharth Sen",
        roleTitle: "Talent Lead - Asia Pacific Infrastructure",
        department: "Civil & Transportation",
        profileUrl: "https://linkedin.com/in/siddharth-sen-aecom",
        email: "siddharth.sen@aecom.com",
        isVerified: true,
      }
    }
  ];

  for (const item of opps) {
    const opp = await prisma.opportunity.upsert({
      where: { canonicalHash: item.canonicalHash },
      update: {
        title: item.title,
        companyName: item.companyName,
        location: item.location,
        workMode: item.workMode,
        experienceLevel: item.experienceLevel,
        opportunityType: item.opportunityType,
        salaryMin: item.salaryMin,
        salaryMax: item.salaryMax,
        salaryCurrency: item.salaryCurrency,
        description: item.description,
        requirements: item.requirements,
        skills: item.skills,
        primaryApplyUrl: item.primaryApplyUrl,
        status: item.status,
        lastVerifiedAt: new Date(),
      },
      create: {
        canonicalHash: item.canonicalHash,
        title: item.title,
        companyName: item.companyName,
        location: item.location,
        workMode: item.workMode,
        experienceLevel: item.experienceLevel,
        opportunityType: item.opportunityType,
        salaryMin: item.salaryMin,
        salaryMax: item.salaryMax,
        salaryCurrency: item.salaryCurrency,
        description: item.description,
        requirements: item.requirements,
        skills: item.skills,
        primaryApplyUrl: item.primaryApplyUrl,
        status: item.status,
        firstSeenAt: new Date(),
        lastVerifiedAt: new Date(),
      }
    });

    // Seed SourceListing
    await prisma.sourceListing.upsert({
      where: { id: `source_${item.canonicalHash}` },
      update: {
        applyUrl: item.primaryApplyUrl,
        sourceUrl: item.primaryApplyUrl,
        sourcePlatform: item.sourcePlatform,
        seenAt: new Date(),
      },
      create: {
        id: `source_${item.canonicalHash}`,
        opportunityId: opp.id,
        sourcePlatform: item.sourcePlatform,
        sourceUrl: item.primaryApplyUrl,
        applyUrl: item.primaryApplyUrl,
        verificationStatus: "VERIFIED",
        seenAt: new Date(),
      }
    });

    // Seed CompanyContact
    if (item.contact) {
      await prisma.companyContact.upsert({
        where: { id: `contact_${item.canonicalHash}` },
        update: {
          fullName: item.contact.fullName,
          roleTitle: item.contact.roleTitle,
          profileUrl: item.contact.profileUrl,
          email: item.contact.email,
        },
        create: {
          id: `contact_${item.canonicalHash}`,
          opportunityId: opp.id,
          companyName: item.companyName,
          normalizedName: item.companyName.toLowerCase().replace(/[^a-z0-9]/g, ""),
          fullName: item.contact.fullName,
          roleTitle: item.contact.roleTitle,
          department: item.contact.department,
          profileUrl: item.contact.profileUrl,
          email: item.contact.email,
          isVerified: item.contact.isVerified,
          sourcePlatform: "LINKEDIN",
        }
      });
    }
  }

  console.log(`[SeedMultiDomain] Successfully seeded ${opps.length} diverse engineering opportunities!`);
}
