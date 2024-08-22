// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

error GenreNameEmpty();
error GenreAlreadyExists();
error BettingClosed(string genre);
error BettingPeriodEnded(string genre);
error BetAmountZero();
error BettingPeriodNotEndedYet(string genre);
