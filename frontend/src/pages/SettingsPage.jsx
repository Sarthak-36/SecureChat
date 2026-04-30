import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CameraIcon, SaveIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";

import AvatarImage from "../components/AvatarImage";
import useAuthUser from "../hooks/useAuthUser";
import { deleteAccount, updateProfile, uploadProfilePicture } from "../lib/api";
import { useThemeStore } from "../store/useThemeStore";

const SettingsPage = () => {
  const { authUser } = useAuthUser();
  const { theme } = useThemeStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [formState, setFormState] = useState({
    fullName: "",
    bio: "",
    location: "",
    profilePic: "",
  });

  useEffect(() => {
    if (!authUser) return;

    setFormState({
      fullName: authUser.fullName || "",
      bio: authUser.bio || "",
      location: authUser.location || "",
      profilePic: authUser.profilePic || "",
    });
  }, [authUser]);

  const { mutate: saveProfileMutation, isPending: isSaving } = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not update profile");
    },
  });

  const { mutate: deleteAccountMutation, isPending: isDeleting } = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      toast.success("Account deleted");
      await queryClient.invalidateQueries({ queryKey: ["authUser"] });
      navigate("/signup");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not delete account");
    },
  });

  const handleProfileSave = (event) => {
    event.preventDefault();
    saveProfileMutation(formState);
  };

  const handleProfilePictureUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const response = await uploadProfilePicture(file);
      setFormState((currentState) => ({ ...currentState, profilePic: response.profilePic }));
      toast.success("Profile picture uploaded");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not upload image");
    } finally {
      event.target.value = "";
    }
  };

  const handleDeleteAccount = () => {
    if (!window.confirm("Delete your account permanently? This cannot be undone.")) {
      return;
    }

    deleteAccountMutation();
  };

  const handleRemoveProfilePicture = () => {
    setFormState((currentState) => ({ ...currentState, profilePic: "" }));
    toast.success("Profile picture removed. Save changes to apply it.");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 opacity-70">Manage your profile and account.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body items-center text-center">
              <div className="avatar">
                <div className="w-36 rounded-full bg-base-300 ring ring-primary/20 ring-offset-2 ring-offset-base-200">
                  <AvatarImage src={formState.profilePic} name={formState.fullName} alt="Profile" />
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold">{formState.fullName || "Your profile"}</h2>
                <p className="text-sm opacity-70">{authUser?.email}</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfilePictureUpload}
              />

              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon className="size-4" />
                  Upload Picture
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleRemoveProfilePicture}
                >
                  <CameraIcon className="size-4" />
                  Remove Picture
                </button>
              </div>
            </div>
          </div>

          <form onSubmit={handleProfileSave} className="card bg-base-200 shadow-sm">
            <div className="card-body space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Full Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formState.fullName}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      fullName: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Bio</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-28"
                  value={formState.bio}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      bio: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Location</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formState.location}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      location: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  className={theme === "light" ? "btn btn-light-save" : "btn btn-primary"}
                  type="submit"
                  disabled={isSaving}
                >
                  <SaveIcon className="size-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>

                <button
                  className="btn btn-error btn-outline"
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteAccount}
                >
                  <Trash2Icon className="size-4" />
                  {isDeleting ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
