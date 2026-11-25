# 自动生成：pnpm knowledge:build；请勿手工修改。
def rank_knowledge(cards, tags, question, domains, top_k):
    result = []
    for domain in domains:
        ranked = []
        for card in cards:
            if card['domain'] != domain or card['lifecycle'] != 'active' or card['review']['status'] != 'source_checked' or card['professionalReview']['status'] == 'rejected':
                continue
            score = (sum(tag in tags for tag in card['tags']) + (2 * sum(word in question for word in card['keywords'])))
            if score > 0:
                ranked.append((score, card))
        result.extend(card for score, card in sorted(ranked, key=lambda item: (-item[0], item[1]['id']))[:top_k[domain]])
    return result
