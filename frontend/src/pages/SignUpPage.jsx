import { useState } from "react";
import { ShipWheelIcon } from "lucide-react";
import { Link } from "react-router";

import useSignupOtp from "../hooks/useSignupOtp";

const SignUpPage = () => {
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("request");
  const [infoMessage, setInfoMessage] = useState("");

  const { isPending: isRequestingOtp, error: requestError, requestSignupOtpMutation } = useSignupOtp();
  const { isPending: isVerifyingOtp, error: verifyError, verifySignupOtpMutation } = useSignupOtp(true);

  const handleSignup = (e) => {
    e.preventDefault();
    requestSignupOtpMutation(signupData, {
      onSuccess: () => {
        setStep("verify");
        setInfoMessage("OTP sent to your email. Enter it below to complete registration.");
      },
    });
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    verifySignupOtpMutation(
      { email: signupData.email, otp },
      {
        onSuccess: () => {
          setInfoMessage("OTP verified successfully. Redirecting...");
        },
      }
    );
  };

  return (
    <div
      className="h-screen flex items-center justify-center p-4 sm:p-6 md:p-8"
      data-theme="forest"
    >
      <div className="border border-primary/25 flex flex-col lg:flex-row w-full max-w-5xl mx-auto bg-base-100 rounded-xl shadow-lg overflow-hidden">
        {/* SIGNUP FORM - LEFT SIDE */}
        <div className="w-full lg:w-1/2 p-4 sm:p-8 flex flex-col">
          {/* LOGO */}
          <div className="mb-4 flex items-center justify-start gap-2">
            <ShipWheelIcon className="size-9 text-primary" />
            <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
              SecureChat
            </span>
          </div>

          {/* ERROR MESSAGE IF ANY */}
          {(requestError || verifyError) && (
            <div className="alert alert-error mb-4">
              <span>
                {(requestError || verifyError)?.response?.data?.message ||
                  (requestError || verifyError)?.message ||
                  "Something went wrong"}
              </span>
            </div>
          )}

          <div className="w-full">
            <form onSubmit={step === "request" ? handleSignup : handleVerifyOtp}>
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {step === "request" ? "Create an Account" : "Verify your email"}
                  </h2>
                  <p className="text-sm opacity-70">
                    {step === "request"
                      ? "Join SecureChat and start meeting new friends."
                      : "Enter the 6-digit code sent to your email to finish registration."}
                  </p>
                </div>

                {infoMessage && (
                  <div className="alert alert-info">
                    <span>{infoMessage}</span>
                  </div>
                )}

                <div className="space-y-3">
                  {step === "request" ? (
                    <>
                      {/* FULLNAME */}
                      <div className="form-control w-full">
                        <label className="label">
                          <span className="label-text">Full Name</span>
                        </label>
                        <input
                          type="text"
                          placeholder="John Doe"
                          className="input input-bordered w-full"
                          value={signupData.fullName}
                          onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                          required
                        />
                      </div>
                      {/* EMAIL */}
                      <div className="form-control w-full">
                        <label className="label">
                          <span className="label-text">Email</span>
                        </label>
                        <input
                          type="email"
                          placeholder="john@gmail.com"
                          className="input input-bordered w-full"
                          value={signupData.email}
                          onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                          required
                        />
                      </div>
                      {/* PASSWORD */}
                      <div className="form-control w-full">
                        <label className="label">
                          <span className="label-text">Password</span>
                        </label>
                        <input
                          type="password"
                          placeholder="********"
                          className="input input-bordered w-full"
                          value={signupData.password}
                          onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                          required
                        />
                        <p className="text-xs opacity-70 mt-1">
                          Password must be at least 6 characters long
                        </p>
                      </div>

                      <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-2">
                          <input type="checkbox" className="checkbox checkbox-sm" required />
                          <span className="text-xs leading-tight">
                            I agree to the{" "}
                            <span className="text-primary hover:underline">terms of service</span> and{" "}
                            <span className="text-primary hover:underline">privacy policy</span>
                          </span>
                        </label>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="form-control w-full">
                        <label className="label">
                          <span className="label-text">Email</span>
                        </label>
                        <input
                          type="email"
                          className="input input-bordered w-full"
                          value={signupData.email}
                          disabled
                        />
                      </div>

                      <div className="form-control w-full">
                        <label className="label">
                          <span className="label-text">OTP Code</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="123456"
                          className="input input-bordered w-full"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          required
                        />
                      </div>

                      <button
                        className="btn btn-ghost text-sm"
                        type="button"
                        onClick={() => {
                          setStep("request");
                          setInfoMessage("");
                        }}
                      >
                        Change registration details
                      </button>
                    </>
                  )}
                </div>

                <button className="btn btn-primary w-full" type="submit">
                  {(isRequestingOtp || isVerifyingOtp) ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      Loading...
                    </>
                  ) : step === "request" ? (
                    "Send OTP"
                  ) : (
                    "Verify OTP"
                  )}
                </button>

                <div className="text-center mt-4">
                  <p className="text-sm">
                    Already have an account?{" "}
                    <Link to="/login" className="text-primary hover:underline">
                      Sign in
                    </Link>
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="hidden lg:flex w-full lg:w-1/2 bg-gradient-to-br from-primary to-secondary text-white p-10 items-center justify-center">
          <div className="max-w-md space-y-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] opacity-80">SecureChat</p>
              <h2 className="mt-3 text-3xl font-bold">Create your private chat network</h2>
              <p className="mt-4 text-sm opacity-90">
                Register now to send secure messages, discover friends, and enjoy a smooth onboarding flow.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl bg-white/10 p-5 border border-white/10">
                <p className="font-semibold">Fast setup</p>
                <p className="text-sm opacity-80">Send your email, verify with OTP, and start chatting quickly.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-5 border border-white/10">
                <p className="font-semibold">Secure account</p>
                <p className="text-sm opacity-80">Built with security in mind to protect your profile and chats.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-5 border border-white/10">
                <p className="font-semibold">Beautiful experience</p>
                <p className="text-sm opacity-80">A modern layout for a friendly and polished registration journey.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
