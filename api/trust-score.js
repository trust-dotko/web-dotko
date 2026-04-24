/**
 * /api/trust-score.js — Vercel Serverless Function
 *
 * Calculates the DOTKO Trust Score using the same logic as the Android app.
 * Ported from dtk/dtk/src/utils/trustScoreCalculator.js
 *
 * POST { userData: { ... user profile fields ... } }
 * Returns { score, breakdown, label, description, color }
 */

function calculateTrustScore(userData = {}) {
  const breakdown = {
    identity: { points: 0, max: 25, details: [] },
    businessAge: { points: 0, max: 15, months: 0 },
    gstCompliance: { points: 0, max: 20, details: [] },
    transparency: { points: 0, max: 15, details: [] },
    consistency: { points: 0, max: 15, details: [] },
    adminVerification: { points: 0, max: 10 },
    redFlags: { points: 0, details: [] },
  };

  // 1. IDENTITY & REGISTRATION — 25 Points
  if (userData.pan) {
    breakdown.identity.points += 5;
    breakdown.identity.details.push('Valid PAN (+5)');
  }
  if (userData.gst) {
    breakdown.identity.points += 10;
    breakdown.identity.details.push('Active GSTIN (+10)');
  }
  if (userData.udyamNumber) {
    breakdown.identity.points += 5;
    breakdown.identity.details.push('Udyam Registration (+5)');
  }
  if (['LLP', 'Private Limited', 'Public Limited'].includes(userData.entityType)) {
    breakdown.identity.points += 5;
    breakdown.identity.details.push('MCA Registration (+5)');
  }

  // 2. BUSINESS AGE — 15 Points
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const estYear = parseInt(userData.establishmentYear || userData.yearOfEstablishment);

  if (estYear) {
    const ageMonths = (currentYear - estYear) * 12 + currentMonth;
    breakdown.businessAge.months = ageMonths;

    if (ageMonths < 6) {
      breakdown.businessAge.points = 0;
      breakdown.redFlags.points -= 3;
      breakdown.redFlags.details.push('Newly registered entity (-3)');
    } else if (ageMonths < 12) {
      breakdown.businessAge.points = 5;
    } else if (ageMonths < 36) {
      breakdown.businessAge.points = 10;
    } else {
      breakdown.businessAge.points = 15;
    }
  }

  // 3. GST COMPLIANCE — 20 Points
  if (userData.gst) {
    if (userData.gstStatus === 'active') {
      breakdown.gstCompliance.points += 5;
      breakdown.gstCompliance.details.push('GST status active (+5)');
    }
    if (userData.regularGSTFiling === true) {
      breakdown.gstCompliance.points += 5;
      breakdown.gstCompliance.details.push('Regular GST filing (+5)');
    }
    if (userData.noComplianceGaps === true) {
      breakdown.gstCompliance.points += 5;
      breakdown.gstCompliance.details.push('No compliance gaps (+5)');
    }
    if (userData.noRegistrationChanges === true) {
      breakdown.gstCompliance.points += 5;
      breakdown.gstCompliance.details.push('No registration changes (+5)');
    }
  }

  // GST Red Flags
  if (userData.gstCancelled || userData.gstSuspended) {
    breakdown.redFlags.points -= 5;
    breakdown.redFlags.details.push('GST cancelled/suspended (-5)');
  }
  if (userData.gstInactiveHistory === true) {
    breakdown.redFlags.points -= 5;
    breakdown.redFlags.details.push('GST inactive history (-5)');
  }
  if (userData.frequentAddressChanges === true) {
    breakdown.redFlags.points -= 3;
    breakdown.redFlags.details.push('Frequent address changes (-3)');
  }
  if (userData.dormantActiveFlips === true) {
    breakdown.redFlags.points -= 3;
    breakdown.redFlags.details.push('Dormant-active flips (-3)');
  }

  // 4. TRANSPARENCY & VERIFICATION — 15 Points
  if (userData.documents?.gstCertificate?.url) {
    breakdown.transparency.points += 5;
    breakdown.transparency.details.push('GST certificate uploaded (+5)');
  }
  if (userData.panVerified === true) {
    breakdown.transparency.points += 5;
    breakdown.transparency.details.push('PAN verified (+5)');
  }
  if (userData.addressVerified === true) {
    breakdown.transparency.points += 5;
    breakdown.transparency.details.push('Address verified (+5)');
  }

  // 5. BUSINESS CONSISTENCY — 15 Points
  if (userData.numberOfEmployees || userData.employeeBase) {
    breakdown.consistency.points += 5;
    breakdown.consistency.details.push('Declared employee base (+5)');
  }
  if (userData.primaryActivity || userData.consistentBusinessActivity === true) {
    breakdown.consistency.points += 5;
    breakdown.consistency.details.push('Consistent business activity (+5)');
  }
  if (userData.conflictingSectorDeclarations === false) {
    breakdown.consistency.points += 5;
    breakdown.consistency.details.push('No conflicting declarations (+5)');
  }

  // Additional Red Flags
  if (userData.multipleLinkedEntities === true) {
    breakdown.redFlags.points -= 5;
    breakdown.redFlags.details.push('Multiple linked entities (-5)');
  }
  if (userData.highRiskSector === true) {
    breakdown.redFlags.points -= 2;
    breakdown.redFlags.details.push('High-risk sector tag (-2)');
  }

  // 6. ADMIN VERIFICATION — 10 Points
  if (userData.isVerified || userData.verified || userData.adminVerified) {
    breakdown.adminVerification.points = 10;
  }

  // Calculate total
  const total =
    breakdown.identity.points +
    breakdown.businessAge.points +
    breakdown.gstCompliance.points +
    breakdown.transparency.points +
    breakdown.consistency.points +
    breakdown.adminVerification.points +
    breakdown.redFlags.points;

  const score = Math.max(0, Math.min(100, total));

  let label, description, color;
  if (score >= 80) { label = 'High Trust'; description = 'Strongly verifiable'; color = '#22C55E'; }
  else if (score >= 60) { label = 'Medium Trust'; description = 'Generally reliable'; color = '#3B82F6'; }
  else if (score >= 40) { label = 'Caution'; description = 'Limited verification'; color = '#F59E0B'; }
  else { label = 'High Risk'; description = 'Proceed carefully'; color = '#EF4444'; }

  return { score, breakdown, label, description, color };
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { userData } = req.body || {};

  if (!userData || typeof userData !== 'object') {
    return res.status(400).json({ error: 'userData object is required' });
  }

  const result = calculateTrustScore(userData);
  return res.status(200).json(result);
}
