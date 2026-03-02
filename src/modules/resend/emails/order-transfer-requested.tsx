import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

type OrderTransferRequestedEmailProps = {
  order: {
    id: string;
    display_id?: number | string;
    email?: string;
  };
  token: string;
  accept_url: string;
  customer?: {
    first_name?: string;
    email?: string;
  };
};

function OrderTransferRequestedEmailComponent({
  order,
  token,
  accept_url,
  customer,
}: OrderTransferRequestedEmailProps) {
  const customerName = customer?.first_name || customer?.email || "there";
  const orderLabel = order.display_id ? `#${order.display_id}` : order.id;

  return (
    <Tailwind>
      <Html>
        <Head />
        <Preview>{`Confirm transfer for order ${orderLabel}`}</Preview>
        <Body className="bg-white my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[560px]">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[20px] mx-0">
              Confirm Order Transfer
            </Heading>

            <Section className="my-[24px]">
              <Text className="text-black text-[14px] leading-[24px]">
                Hi {customerName},
              </Text>
              <Text className="text-black text-[14px] leading-[24px]">
                You have a pending request to transfer order{" "}
                <strong>{orderLabel}</strong> to your customer account.
              </Text>
              <Text className="text-black text-[14px] leading-[24px]">
                To complete the transfer, open your account and confirm using
                this token:
              </Text>
            </Section>

            <Section className="bg-[#f6f9fc] rounded border border-solid border-[#eaeaea] px-[16px] py-[12px] my-[18px]">
              <Text className="text-[12px] uppercase tracking-[0.08em] text-[#666666] m-0">
                Transfer token
              </Text>
              <Text className="text-[16px] leading-[24px] text-black font-bold m-0 break-all">
                {token}
              </Text>
            </Section>

            <Section className="text-center mt-[26px] mb-[20px]">
              <Button
                className="bg-[#000000] rounded text-white text-[13px] font-semibold no-underline text-center px-5 py-3"
                href={accept_url}
              >
                Open transfer confirmation
              </Button>
            </Section>

            <Section className="my-[18px]">
              <Text className="text-black text-[13px] leading-[22px] m-0 mb-[8px]">
                If the button does not work, use this link:
              </Text>
              <Link
                href={accept_url}
                className="text-blue-600 no-underline text-[13px] leading-[22px] break-all"
              >
                {accept_url}
              </Link>
            </Section>

            <Section className="mt-[24px] pt-[16px] border-t border-solid border-[#eaeaea]">
              <Text className="text-[#666666] text-[12px] leading-[20px]">
                If you did not expect this transfer request, you can safely
                ignore this email.
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

export const orderTransferRequestedEmail = (
  props: OrderTransferRequestedEmailProps
) => <OrderTransferRequestedEmailComponent {...props} />;

export default OrderTransferRequestedEmailComponent;
