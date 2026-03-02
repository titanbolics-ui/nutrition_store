import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

type CustomerWelcomeEmailProps = {
  customer: {
    first_name?: string;
  };
  store_url: string;
};

function CustomerWelcomeEmailComponent({
  customer,
  store_url,
}: CustomerWelcomeEmailProps) {
  return (
    <Tailwind>
      <Html>
        <Head />
        <Preview>Welcome to Onyx Genetics! 💪</Preview>
        <Body className="bg-white my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[560px]">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[20px] mx-0">
              Welcome to the Club!
            </Heading>

            <Section className="my-[24px]">
              <Text className="text-black text-[14px] leading-[24px]">
                Hi {customer.first_name || "Athlete"},
              </Text>
              <Text className="text-black text-[14px] leading-[24px]">
                Thank you for registering. We are glad to have you with us. Your
                account is ready and you can start exploring our products now.
              </Text>
            </Section>

            <Section className="text-center mt-[26px] mb-[20px]">
              <Button
                className="bg-[#000000] rounded text-white text-[13px] font-semibold no-underline text-center px-5 py-3"
                href={store_url}
              >
                Go to Store
              </Button>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

export const customerWelcomeEmail = (props: CustomerWelcomeEmailProps) => (
  <CustomerWelcomeEmailComponent {...props} />
);

export default CustomerWelcomeEmailComponent;
