"use client";

import { FC, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Camera,
  User as UserIcon,
  AtSign,
  Mail,
  CheckCircle2,
  Pencil,
  LucideIcon,
  ArrowLeft,
  Loader2,
} from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import BankAccountModal from "./BankAccountModal";
import { bankService } from "@/services/api/bank";
import { BankDetail, User } from "@/types/db";
import { updateProfile } from "@/services/api/user";

interface ProfilePageProps {
  initialProfile: User;
}
const profileSchema = z.object({
  displayName: z.string().min(2, "Name is too short"),
  kellonTag: z.string().min(3, "Tag is too short"), // No longer requires user to type @
});
type ProfileFormValues = z.infer<typeof profileSchema>;

const ProfilePage: FC<ProfilePageProps> = ({ initialProfile }) => {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const profile = initialProfile;

  // --- Bank State Lifted Here ---
  const [banks, setBanks] = useState<BankDetail[]>([]);
  const [isBanksLoading, setIsBanksLoading] = useState(true);

  const fetchBanks = async () => {
    setIsBanksLoading(true);
    try {
      const response = await bankService.getBanks();
      if (response?.data) {
        setBanks(response.data);
      }
      return response;
    } catch (error) {
      throw error;
    } finally {
      setIsBanksLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: profile?.name || "",
      kellonTag: profile?.tag?.replace("@", "") || "",
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSubmitting(true);

    try {
      const res = await updateProfile({
        name: data.displayName,
        tag: data.kellonTag.replace("@", ""),
      });

      if (res.success) {
        toast.success("Profile updated successfully!");

        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(res.message || "Failed to update profile");
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto min-h-[100dvh] w-full max-w-2xl px-6 pb-10 pt-5 text-slate-900 transition-colors duration-300 dark:text-white md:pt-20">
      <div className="mb-8 flex items-center justify-between">
        <button
          type="button"
          aria-label="Back to wallet"
          onClick={() => router.push("/")}
          className="cursor-pointer rounded-full border border-slate-200 bg-white p-2 shadow-sm hover:bg-slate-100 dark:border-white/10 dark:bg-secondary-60/50 dark:hover:bg-secondary-60"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold">
          {isEditing ? "Edit Profile" : "Profile"}
        </h1>
        <div className="w-10" />
      </div>

      <div className="space-y-6">
        {/* Profile Card */}
        <div className="bg-white dark:bg-secondary-50 rounded-[32px] p-8 flex flex-col items-center text-center space-y-4  border border-slate-100  dark:border-white/10">
          <div className="relative">
            <Avatar className="w-28 h-28 border-4 border-white dark:border-none bg-primary-70 shadow-md">
              <AvatarFallback className="text-3xl font-bold bg-primary-70 text-white">
                {profile?.name
                  ?.split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "?"}
              </AvatarFallback>
            </Avatar>
            <button className="absolute bottom-0 right-0 p-2 bg-white dark:bg-black1 border-2 border-gray-50 dark:border-[#0b101a] rounded-full text-primary-70 shadow-lg cursor-pointer">
              <Camera className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold">
              {form.getValues("displayName")}
            </h2>
            <p className="text-slate-500 dark:text-gray-400 text-sm">
              {profile?.email}
            </p>
          </div>
          <Badge className="bg-slate-100 dark:bg-black1 text-primary-70 py-1.5 px-4 rounded-full border-none">
            {`@${form.getValues("kellonTag")}`}
          </Badge>
        </div>

        {/* Info Section */}
        <div className="bg-white dark:bg-secondary-50 rounded-[32px] p-6 border border-slate-100 dark:border-white/10">
          <div className="flex items-center justify-between mb-6 px-1">
            <h3 className="font-semibold text-lg">Profile Information</h3>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-primary-70 hover:bg-primary-70/10 rounded-full transition-colors cursor-pointer"
              >
                <Pencil className="w-5 h-5" />
              </button>
            )}
          </div>

          {!isEditing ? (
            <div className="space-y-6">
              <InfoItem
                icon={UserIcon}
                label="Display Name"
                value={form.getValues("displayName")}
              />
              <InfoItem
                icon={AtSign}
                label="Kellon Tag"
                value={form.getValues("kellonTag")}
              />
              <div className="flex items-start flex-1 gap-2 sm:gap-4 px-1 min-w-0">
                <div className="p-3 bg-slate-100 dark:bg-black1 rounded-xl text-primary-70">
                  <Mail className="w-5 h-5" />
                </div>

                <div className="flex-1 border-b border-slate-100 dark:border-gray-800 pb-3 sm:pb-4 min-w-0">
                  <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    Email
                  </p>

                  <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate break-all">
                      {profile?.email}
                    </p>

                    <Badge className="bg-green-500/10 text-green-600 border-none flex gap-1 items-center px-2 py-0.5 shrink-0 self-start xs:self-center">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-500">
                        Display Name
                      </FormLabel>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-3 w-5 h-5 text-primary-70" />
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-gray-95 dark:bg-secondary-60 border-black/5 dark:border-white/10 h-12 pl-12 rounded-2xl text-black dark:text-white placeholder:text-gray-400 focus-visible:ring-primary-70/20"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="kellonTag"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-500">
                        Kellon Tag
                      </FormLabel>
                      <div className="relative">
                        <AtSign className="absolute left-4 top-3 w-5 h-5 text-primary-70" />
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-gray-95 dark:bg-secondary-60 border-black/5 dark:border-white/10 h-12 pl-12 rounded-2xl text-black dark:text-white placeholder:text-gray-400 focus-visible:ring-primary-70/20"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    className="group relative flex-1 overflow-hidden rounded-xl border border-black/5 bg-white py-3 font-bold transition-all hover:bg-gray-50 active:scale-95 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50 cursor-pointer"
                    onClick={() => setIsEditing(false)}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2 text-sm md:text-base">
                      Cancel
                    </span>
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-gray-900/5 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group relative flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-primary-70 to-primary-60 py-3 font-bold text-white shadow-lg transition-all hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2 text-sm md:text-base">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </span>
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                  </button>
                </div>
              </form>
            </Form>
          )}
        </div>

        {/* Bank Component now receives data from parent */}
        <BankAccountModal
          banks={banks}
          isLoading={isBanksLoading}
          onRefresh={async () => {
            await fetchBanks();
          }}
        />
      </div>
    </section>
  );
};

const InfoItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) => (
  <div className="flex items-center gap-4 px-1">
    <div className="p-3 bg-slate-100 dark:bg-black1 rounded-xl text-primary-70">
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex-1 border-b border-slate-100 dark:border-gray-800 pb-4">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  </div>
);

export default ProfilePage;
