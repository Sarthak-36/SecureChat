import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requestSignupOtp, verifySignupOtp } from "../lib/api";

const useSignupOtp = (verify = false) => {
  const queryClient = useQueryClient();
  const mutationFn = verify ? verifySignupOtp : requestSignupOtp;

  const { mutate, isPending, error } = useMutation({
    mutationFn,
    onSuccess: () => {
      if (verify) {
        queryClient.invalidateQueries({ queryKey: ["authUser"] });
      }
    },
  });

  return verify
    ? { isPending, error, verifySignupOtpMutation: mutate }
    : { isPending, error, requestSignupOtpMutation: mutate };
};

export default useSignupOtp;
