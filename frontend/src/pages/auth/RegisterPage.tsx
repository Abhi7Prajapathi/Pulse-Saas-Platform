import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../../context/AuthContext";
import { Button, FieldError, Input } from "../../components/ui/primitives";
import { apiErrorMessage, useToast } from "../../components/common/Toast";
import { AuthShell } from "./LoginPage";

const schema = z
  .object({
    name: z.string().min(1, "Your name is required."),
    email: z.string().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm_password: z.string().min(1, "Please confirm your password."),
    organization_name: z.string().min(1, "Organization name is required."),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await registerUser(values);
      showToast("Welcome to Pulse!");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setServerError(apiErrorMessage(error));
    }
  };

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-semibold text-text-primary">Create your workspace</h1>
      <p className="mt-1 text-sm text-text-secondary">Set up your account and organization in one step.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Full name</label>
          <Input placeholder="Ada Lovelace" {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Email</label>
          <Input type="email" placeholder="you@company.com" {...register("email")} />
          <FieldError message={errors.email?.message} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Password</label>
          <div className="relative">
            <Input type={showPassword ? "text" : "password"} placeholder="At least 8 characters" {...register("password")} />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError message={errors.password?.message} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Confirm password</label>
          <Input type={showPassword ? "text" : "password"} placeholder="Re-enter your password" {...register("confirm_password")} />
          <FieldError message={errors.confirm_password?.message} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Organization name</label>
          <Input placeholder="Acme Inc." {...register("organization_name")} />
          <FieldError message={errors.organization_name?.message} />
        </div>

        {serverError && <p className="text-sm text-danger">{serverError}</p>}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-teal-400 hover:text-teal-300">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
