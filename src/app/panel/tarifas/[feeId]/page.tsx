import { Title } from "~/components/title";
import { api } from "~/trpc/server";
import FeePage from "./fee-page";

export default async function Channel(props: { params: { feeId: string } }) {
  const fee = await api.fee.getByIdProt.query({
    id: props.params.feeId,
  });

  const sizes = await api.size.getProt.query({
    store: null
  });

  const coins = await api.coin.get.query();

  if (!fee) {
    return <Title>No se encontró la moneda</Title>;
  }

  return <FeePage fee={fee} sizes={sizes} coins={coins} />;
}
