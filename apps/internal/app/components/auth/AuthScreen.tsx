"use client";

import { PawPrint, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { AccountSession } from "../../lib/accountStore";
import { useClinicBrand } from "../ClinicContext";
import { CustomerLogin, CustomerSignup } from "./CustomerAuthForms";
import { StaffPortal } from "./StaffAuthForms";

type Props = {
  onAuth: (session: AccountSession) => void;
  onLegacyStaff: () => void;
};

type Tab = "customer" | "staff";
type CustomerView = "login" | "signup";

export function AuthScreen({ onAuth, onLegacyStaff }: Props) {
  const [tab, setTab] = useState<Tab>("customer");
  const [customerView, setCustomerView] = useState<CustomerView>("login");
  const clinic = useClinicBrand();

  return (
    <div className="authShell">
      <div className="authBrandPanel">
        <div className="authBrandContent">
          <div className="authBrandHeader">
            <div className="authBrandLogo">
              <PawPrint size={24} strokeWidth={2.5} />
            </div>
            <div className="authBrandWordmark">
              <span className="authBrandWordmarkName">{clinic.shortName}</span>
              <span className="authBrandWordmarkSub">Portal</span>
            </div>
          </div>
          <h1 className="authBrandTitle">
            Care that<br />goes further
          </h1>
          <p className="authBrandTagline">
            Book visits, check in, and view records, all in one simple place for you and your pet.
          </p>
          <div className="authBrandFeatures">
            <div className="authBrandFeature">
              <span className="authBrandFeatureDot" />
              Book appointments anytime
            </div>
            <div className="authBrandFeature">
              <span className="authBrandFeatureDot" />
              Simple care guidance
            </div>
            <div className="authBrandFeature">
              <span className="authBrandFeatureDot" />
              Secure pet records
            </div>
          </div>
        </div>
        <div className="authBrandFooter">
          <span className="authBrandFooterMark">
            <ShieldCheck size={14} strokeWidth={2.2} />
          </span>
          Private and secure. Your information stays protected.
        </div>
      </div>

      <div className="authFormPanel">
        <div className="authCard">
          <div className="authTabs">
            <button
              className={`authTab${tab === "customer" ? " authTab--active" : ""}`}
              type="button"
              onClick={() => setTab("customer")}
            >
              Pet Owner
            </button>
            <button
              className={`authTab${tab === "staff" ? " authTab--active" : ""}`}
              type="button"
              onClick={() => setTab("staff")}
            >
              Clinic Team
            </button>
          </div>

          {tab === "customer" ? (
            customerView === "login" ? (
              <CustomerLogin onAuth={onAuth} onSwitch={() => setCustomerView("signup")} />
            ) : (
              <CustomerSignup onAuth={onAuth} onSwitch={() => setCustomerView("login")} />
            )
          ) : (
            <StaffPortal onAuth={onAuth} onLegacyStaff={onLegacyStaff} />
          )}
        </div>
        <p className="authFormFooter">Secure sign-in for {clinic.name}</p>
      </div>
    </div>
  );
}
