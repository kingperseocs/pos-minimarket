import { getGoalProgressUseCase } from "@/application/use-cases/goals/goal-progress";
import { goalDeps } from "@/infrastructure/deps";
import { GoalHeaderButton } from "./goal-header-button";

export async function GoalHeaderWidget() {
  const progress = await getGoalProgressUseCase(goalDeps);
  return <GoalHeaderButton progress={progress} />;
}
